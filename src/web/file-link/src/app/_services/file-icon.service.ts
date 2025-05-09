// file-type-icon.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FileTypeIconService {
  /**
   * Get the appropriate Lucide icon name for a given file extension
   * @param filename Filename or extension
   * @returns Lucide icon name
   */
  getIconForFile(filename: string): string {
    if (!filename) return 'file';

    // Get extension from filename
    const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : filename.toLowerCase();

    if (!extension) return 'file';

    // Map extensions to icons
    switch (extension) {
      // Documents
      case 'pdf':
        return 'file-text';
      case 'doc':
      case 'docx':
      case 'odt':
      case 'rtf':
        return 'file-text';
      case 'txt':
      case 'md':
        return 'file-text';

      // Spreadsheets
      case 'xls':
      case 'xlsx':
      case 'csv':
      case 'ods':
        return 'file-spreadsheet';

      // Presentations
      case 'ppt':
      case 'pptx':
      case 'odp':
        return 'file-chart-line';

      // Images
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'tiff':
      case 'webp':
      case 'svg':
        return 'file-image';

      // Audio
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
      case 'm4a':
      case 'aac':
        return 'file-audio';

      // Video
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'mkv':
      case 'webm':
      case 'flv':
        return 'file-video';

      // Archives
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
      case 'bz2':
        return 'file-archive';

      // Code
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return 'file-code';
      case 'java':
      case 'py':
      case 'rb':
      case 'php':
      case 'c':
      case 'cpp':
      case 'h':
      case 'cs':
      case 'go':
      case 'rs':
      case 'swift':
      case 'kt':
        return 'file-code';

      // Executables
      case 'exe':
      case 'msi':
      case 'bat':
      case 'sh':
      case 'bin':
      case 'app':
      case 'apk':
        return 'file-cog';

      // Database
      case 'sql':
      case 'db':
      case 'sqlite':
      case 'mdb':
        return 'database';

      // Web
      case 'xml':
        return 'file-code';
      case 'json':
        return 'file-json';

      // Scripts
      case 'ps1':
        return 'terminal';
      case 'bash':
        return 'terminal';

      // Config
      case 'yml':
      case 'yaml':
      case 'toml':
      case 'ini':
      case 'env':
      case 'config':
        return 'file-cog';

      // Font
      case 'ttf':
      case 'otf':
      case 'woff':
      case 'woff2':
        return 'file-type';

      // Disk images
      case 'iso':
      case 'img':
      case 'dmg':
        return 'disc';

      // eBooks
      case 'epub':
      case 'mobi':
        return 'book-open';

      // Programming-specific
      case 'dll':
      case 'jar':
        return 'file-symlink';
      case 'class':
        return 'coffee'; // Java

      // Certificate/Keys
      case 'key':
      case 'pem':
      case 'crt':
      case 'cer':
        return 'file-check';

      // Binary
      case 'dat':
        return 'binary';

      // Default
      default:
        return 'file';
    }
  }
}
