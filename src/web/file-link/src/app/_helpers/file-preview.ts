export enum PreviewType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Pdf = 'pdf',
  Text = 'text',
  None = 'none',
}

const extensionMap: Record<string, PreviewType> = {
  // Images (handled by Fancybox gallery already)
  jpg: PreviewType.Image,
  jpeg: PreviewType.Image,
  png: PreviewType.Image,
  gif: PreviewType.Image,
  webp: PreviewType.Image,
  svg: PreviewType.Image,

  // Video (browser-supported only)
  mp4: PreviewType.Video,
  webm: PreviewType.Video,
  mov: PreviewType.Video,

  // Audio
  mp3: PreviewType.Audio,
  wav: PreviewType.Audio,
  ogg: PreviewType.Audio,
  flac: PreviewType.Audio,
  aac: PreviewType.Audio,

  // PDF
  pdf: PreviewType.Pdf,

  // Text / Code
  txt: PreviewType.Text,
  csv: PreviewType.Text,
  json: PreviewType.Text,
  xml: PreviewType.Text,
  html: PreviewType.Text,
  htm: PreviewType.Text,
  css: PreviewType.Text,
  js: PreviewType.Text,
  ts: PreviewType.Text,
  cs: PreviewType.Text,
  py: PreviewType.Text,
  java: PreviewType.Text,
  c: PreviewType.Text,
  cpp: PreviewType.Text,
  h: PreviewType.Text,
  rb: PreviewType.Text,
  go: PreviewType.Text,
  rs: PreviewType.Text,
  sh: PreviewType.Text,
  bash: PreviewType.Text,
  yaml: PreviewType.Text,
  yml: PreviewType.Text,
  md: PreviewType.Text,
  log: PreviewType.Text,
  ini: PreviewType.Text,
  cfg: PreviewType.Text,
  conf: PreviewType.Text,
  sql: PreviewType.Text,
};

export function getPreviewType(filename: string): PreviewType {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return PreviewType.None;
  const ext = filename.substring(idx + 1).toLowerCase();
  return extensionMap[ext] ?? PreviewType.None;
}

export function getViewUrl(baseUrl: string): string {
  return baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'view=true';
}
