import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { z } from 'zod';

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Keep OpenAI only for DALL-E image generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

async function claudeStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  schemaName: string
): Promise<T | null> {
  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [
      {
        name: schemaName,
        description: `Respond with structured data matching the ${schemaName} schema`,
        input_schema: zodToJsonSchema(schema) as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool' as const, name: schemaName },
  });

  const toolBlock = response.content.find(
    (block) => block.type === 'tool_use' && block.name === schemaName
  );
  if (toolBlock && toolBlock.type === 'tool_use') {
    return schema.parse(toolBlock.input);
  }
  return null;
}

function zodToJsonSchema(schema: z.ZodType<any>): Record<string, any> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType<any>);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    return { type: 'object', properties, required };
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element),
      ...(schema.description ? { description: schema.description } : {}),
    };
  }
  if (schema instanceof z.ZodString) {
    const checks = (schema as any)._def.checks || [];
    const maxCheck = checks.find((c: any) => c.kind === 'max');
    return {
      type: 'string',
      ...(maxCheck ? { maxLength: maxCheck.value } : {}),
      ...(schema.description ? { description: schema.description } : {}),
    };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  return { type: 'string' };
}

@Injectable()
export class OpenaiService {
  async generateImage(prompt: string, isUrl: boolean, isVertical = false) {
    // Image generation stays on OpenAI (DALL-E)
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for image generation');
    }
    const generate = (
      await openai.images.generate({
        prompt,
        response_format: isUrl ? 'url' : 'b64_json',
        model: 'dall-e-3',
        ...(isVertical ? { size: '1024x1792' } : {}),
      })
    ).data[0];

    return isUrl ? generate.url : generate.b64_json;
  }

  async generateAltText(imageUrl: string, postContext?: string): Promise<string> {
    const isBase64 = imageUrl.startsWith('data:');
    const imageContent: Anthropic.ImageBlockParam = isBase64
      ? {
          type: 'image',
          source: {
            type: 'base64',
            media_type: (imageUrl.split(';')[0].split(':')[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageUrl.split(',')[1],
          },
        }
      : {
          type: 'image',
          source: { type: 'url', url: imageUrl },
        };

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: `Write concise, descriptive alt text for this image for accessibility. Be factual about what is visible. Do not start with "Image of" or "Photo of". Keep it under 125 characters. Return only the alt text, nothing else.${postContext ? `\n\nContext from the post this image is attached to: "${postContext}"` : ''}`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
  }

  async generatePromptForPicture(prompt: string) {
    const PicturePrompt = z.object({ prompt: z.string() });
    const result = await claudeStructured(
      `You are an assistant that takes a description and style and generates a prompt for image generation. Make it very long and descriptive, including camera details for realistic scenes.`,
      `prompt: ${prompt}`,
      PicturePrompt,
      'picturePrompt'
    );
    return result?.prompt || '';
  }

  async generateVoiceFromText(prompt: string) {
    const VoicePrompt = z.object({ voice: z.string() });
    const result = await claudeStructured(
      `You are an assistant that takes a social media post and converts it to natural human speech. When people talk they don't use "-", and sometimes they add pauses with "..." to sound more natural. Use a lot of pauses and make it sound like a real person.`,
      `prompt: ${prompt}`,
      VoicePrompt,
      'voice'
    );
    return result?.voice || '';
  }

  async generatePosts(content: string) {
    const results = await Promise.all([
      claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Generate 5 different Twitter posts from the following content without emojis. Return as a JSON array: [{"post": "..."}]\n\nContent: ${content}`,
          },
        ],
      }),
      claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Generate 5 different social media threads from the following content without emojis. Each thread is an array of posts. Return as a JSON array: [{"post": "..."}]\n\nContent: ${content}`,
          },
        ],
      }),
    ]);

    const posts = results.flatMap((r) => {
      const text =
        r.content[0].type === 'text' ? r.content[0].text : '';
      try {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start === -1 || end === -1) return [];
        return [
          JSON.parse(
            '[' +
              text
                .slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          ),
        ];
      } catch {
        return [];
      }
    });

    return shuffle(posts);
  }

  async extractWebsiteText(content: string) {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract only the article content from this website text:\n\n${content}`,
        },
      ],
    });

    const articleContent =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return this.generatePosts(articleContent);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    const parsed = await claudeStructured(
      `You are an assistant that takes a social media post and breaks it into a thread. Each post must be minimum ${
        len - 10
      } and maximum ${len} characters, keeping the exact wording and line breaks. Split posts based on context.`,
      content,
      SeparatePostsPrompt,
      'separatePosts'
    );

    const posts = parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: string) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              const shrunk = await claudeStructured(
                `You are an assistant that takes a social media post and shrinks it to be maximum ${len} characters, keeping the exact wording and line breaks.`,
                post,
                SeparatePostPrompt,
                'separatePost'
              );
              if (shrunk?.post) return shrunk.post;
            } catch {
              retries--;
            }
          }
          return post;
        })
      ),
    };
  }

  async generateSlidesFromText(text: string) {
    const SlidesSchema = z.object({
      slides: z
        .array(
          z.object({
            imagePrompt: z.string(),
            voiceText: z.string(),
          })
        )
        .describe('an array of slides'),
    });

    for (let i = 0; i < 3; i++) {
      try {
        const result = await claudeStructured(
          `You are an assistant that takes text and breaks it into slides. Each slide should have an image prompt and voice text for video and voice generation. Image prompts should capture the essence of the slide with a dark gradient on top and should not contain text. Generate between 3-5 slides maximum.`,
          text,
          SlidesSchema,
          'slides'
        );
        if (result?.slides) return result.slides;
      } catch (err) {
        console.log(err);
      }
    }
    return [];
  }
}
