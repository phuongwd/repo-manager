import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

export function formatRepoStatus(status: any): { text: string; className: string } {
  if (typeof status === 'string') {
    switch (status) {
      case 'Clean':
        return { text: 'Clean', className: 'text-green-600 bg-green-100' };
      case 'Dirty':
        return { text: 'Changes', className: 'text-orange-600 bg-orange-100' };
      case 'Untracked':
        return { text: 'Untracked', className: 'text-blue-600 bg-blue-100' };
      case 'NoGit':
        return { text: 'No Git', className: 'text-gray-600 bg-gray-100' };
      default:
        return { text: status, className: 'text-gray-600 bg-gray-100' };
    }
  } else if (typeof status === 'object' && status.Error) {
    return { text: 'Error', className: 'text-red-600 bg-red-100' };
  }
  
  return { text: 'Unknown', className: 'text-gray-600 bg-gray-100' };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}