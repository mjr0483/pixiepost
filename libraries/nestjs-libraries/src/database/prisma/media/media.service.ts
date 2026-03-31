import { HttpException, Injectable } from '@nestjs/common';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { Organization } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import {
  readdirSync,
  statSync,
  existsSync,
} from 'fs';
import { join, extname, basename } from 'path';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@Injectable()
export class MediaService {
  private storage = UploadFactory.createStorage();

  constructor(
    private _mediaRepository: MediaRepository,
    private _openAi: OpenaiService,
    private _subscriptionService: SubscriptionService,
    private _videoManager: VideoManager
  ) {}

  async deleteMedia(org: string, id: string) {
    return this._mediaRepository.deleteMedia(org, id);
  }

  getMediaById(id: string) {
    return this._mediaRepository.getMediaById(id);
  }

  async generateImage(
    prompt: string,
    org: Organization,
    generatePromptFirst?: boolean
  ) {
    const generating = await this._subscriptionService.useCredit(
      org,
      'ai_images',
      async () => {
        if (generatePromptFirst) {
          prompt = await this._openAi.generatePromptForPicture(prompt);
          console.log('Prompt:', prompt);
        }
        return this._openAi.generateImage(prompt, !!generatePromptFirst);
      }
    );

    return generating;
  }

  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._mediaRepository.saveFile(org, fileName, filePath, originalName);
  }

  getMedia(org: string, page: number) {
    return this._mediaRepository.getMedia(org, page);
  }

  async generateAltText(org: string, id: string, path: string) {
    const frontendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.FRONTEND_URL || '';
    const fullUrl = path.startsWith('http') ? path : `${frontendUrl}${path}`;
    const alt = await this._openAi.generateAltText(fullUrl);
    if (alt && id) {
      await this._mediaRepository.saveMediaInformation(org, { id, alt });
    }
    return { alt };
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._mediaRepository.saveMediaInformation(org, data);
  }

  getVideoOptions() {
    return this._videoManager.getAllVideos();
  }

  async generateVideoAllowed(org: Organization, type: string) {
    const video = this._videoManager.getVideoByName(type);
    if (!video) {
      throw new Error(`Video type ${type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    return true;
  }

  async generateVideo(org: Organization, body: VideoDto) {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      'ai_videos'
    );

    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.VIDEOS_PER_MONTH,
      });
    }

    const video = this._videoManager.getVideoByName(body.type);
    if (!video) {
      throw new Error(`Video type ${body.type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    console.log(body.customParams);
    await video.instance.processAndValidate(body.customParams);
    console.log('no err');

    return await this._subscriptionService.useCredit(
      org,
      'ai_videos',
      async () => {
        const loadedData = await video.instance.process(
          body.output,
          body.customParams
        );

        const file = await this.storage.uploadSimple(loadedData);
        return this.saveFile(org.id, file.split('/').pop(), file);
      }
    );
  }

  private get serverPhotosDir(): string {
    return process.env.SERVER_PHOTOS_DIR || '/server-photos';
  }

  private static readonly IMAGE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic',
  ]);

  private isImageFile(filename: string): boolean {
    return MediaService.IMAGE_EXTENSIONS.has(extname(filename).toLowerCase());
  }

  getServerFolders() {
    const baseDir = join(this.serverPhotosDir, 'Social Media to be published');
    if (!existsSync(baseDir)) {
      return { folders: [] };
    }

    const entries = readdirSync(baseDir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && e.name !== '_gsdata_')
      .map((e) => {
        const folderPath = join(baseDir, e.name);
        const subEntries = readdirSync(folderPath, { withFileTypes: true });
        const subfolders = subEntries
          .filter((s) => s.isDirectory() && s.name !== '_gsdata_')
          .map((s) => s.name);
        return { name: e.name, subfolders };
      });

    return { folders };
  }

  getServerFiles(folder: string, subfolder: string, page: number) {
    // Sanitize: prevent path traversal
    const safeFolderName = basename(folder);
    const safeSubfolder = basename(subfolder);
    const dirPath = join(
      this.serverPhotosDir,
      'Social Media to be published',
      safeFolderName,
      safeSubfolder
    );

    if (!existsSync(dirPath)) {
      return { files: [], pages: 0, total: 0 };
    }

    const allFiles = readdirSync(dirPath)
      .filter((f) => this.isImageFile(f))
      .sort();

    const pageNum = Math.max(0, (page || 1) - 1);
    const perPage = 18;
    const total = allFiles.length;
    const pages = Math.ceil(total / perPage);
    const files = allFiles.slice(pageNum * perPage, (pageNum + 1) * perPage).map((f) => {
      const relPath = `/server-photos/Social Media to be published/${encodeURIComponent(safeFolderName)}/${encodeURIComponent(safeSubfolder)}/${encodeURIComponent(f)}`;
      return {
        name: f,
        path: process.env.FRONTEND_URL + relPath,
        folder: safeFolderName,
        subfolder: safeSubfolder,
      };
    });

    return { files, pages, total };
  }

  async importServerFiles(
    orgId: string,
    files: { path: string; originalName: string }[]
  ) {
    const results = [];
    for (const file of files) {
      // Extract the local filesystem path from the URL
      const url = new URL(file.path);
      const decodedPath = decodeURIComponent(url.pathname);

      // Must start with /server-photos/ to prevent arbitrary file reads
      if (!decodedPath.startsWith('/server-photos/')) {
        continue;
      }

      // Verify the file exists on disk
      if (!existsSync(decodedPath)) {
        continue;
      }

      // Direct reference: store the server-photos URL without copying
      // At publish time, readOrFetch() will fetch via HTTP since path starts with http
      const serverPhotoUrl = process.env.FRONTEND_URL + decodedPath;

      const saved = await this._mediaRepository.saveFile(
        orgId,
        basename(decodedPath),
        serverPhotoUrl,
        file.originalName
      );
      results.push(saved);
    }

    return results;
  }

  async videoFunction(identifier: string, functionName: string, body: any) {
    const video = this._videoManager.getVideoByName(identifier);
    if (!video) {
      throw new Error(`Video with identifier ${identifier} not found`);
    }

    // @ts-ignore
    const functionToCall = video.instance[functionName];
    if (
      typeof functionToCall !== 'function' ||
      this._videoManager.checkAvailableVideoFunction(functionToCall)
    ) {
      throw new HttpException(
        `Function ${functionName} not found on video instance`,
        400
      );
    }

    return functionToCall(body);
  }
}
