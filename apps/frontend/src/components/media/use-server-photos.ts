import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';

interface ServerFolder {
  name: string;
  subfolders: string[];
}

interface ServerFile {
  name: string;
  path: string;
  folder: string;
  subfolder: string;
}

export const useServerFolders = () => {
  const fetch = useFetch();
  const loadFolders = useCallback(async () => {
    return (await fetch('/media/server-browse')).json();
  }, []);
  return useSWR<{ folders: ServerFolder[] }>('server-folders', loadFolders);
};

export const useServerFiles = (
  folder: string | null,
  subfolder: string | null,
  page: number
) => {
  const fetch = useFetch();
  const loadFiles = useCallback(async () => {
    if (!folder || !subfolder) return { files: [], pages: 0, total: 0 };
    return (
      await fetch(
        `/media/server-files?folder=${encodeURIComponent(folder)}&subfolder=${encodeURIComponent(subfolder)}&page=${page + 1}`
      )
    ).json();
  }, [folder, subfolder, page]);
  return useSWR<{ files: ServerFile[]; pages: number; total: number }>(
    folder && subfolder ? `server-files-${folder}-${subfolder}-${page}` : null,
    loadFiles
  );
};
