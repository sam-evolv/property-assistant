interface FileIconProps {
  fileName: string;
  className?: string;
}

export function FileIcon({ fileName, className = "h-8 w-8" }: FileIconProps) {
  const extension = fileName?.split('.').pop()?.toLowerCase() || '';
  
  const getIconColor = () => {
    switch (extension) {
      case 'pdf':
        return 'text-red-600';
      case 'doc':
      case 'docx':
        return 'text-gold-500';
      case 'xls':
      case 'xlsx':
      case 'csv':
        return 'text-green-600';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return 'text-purple-600';
      case 'zip':
      case 'rar':
      case '7z':
        return 'text-gold-600';
      case 'txt':
      case 'md':
        return 'text-gray-600';
      case 'json':
      case 'xml':
        return 'text-orange-600';
      default:
        return 'text-gray-500';
    }
  };

  const getIcon = () => {
    switch (extension) {
      case 'pdf':
        return (
          <svg className={`${className} ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg className={`${className} ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
            <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        );
      case 'xls':
      case 'xlsx':
      case 'csv':
        return (
          <svg className={`${className} ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h5a1 1 0 000-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM13 16a1 1 0 102 0v-5.586l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 101.414 1.414L13 10.414V16z" />
          </svg>
        );
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return (
          <svg className={`${className} ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'zip':
      case 'rar':
      case '7z':
        return (
          <svg className={`${className} ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        );
      default:
        return (
          <svg className={`${className} ${getIconColor()}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return getIcon();
}

export function getFileTypeLabel(fileName: string): string {
  const extension = fileName?.split('.').pop()?.toLowerCase() || '';
  
  const labels: { [key: string]: string } = {
    pdf: 'PDF Document',
    doc: 'Word Document',
    docx: 'Word Document',
    xls: 'Excel Spreadsheet',
    xlsx: 'Excel Spreadsheet',
    csv: 'CSV File',
    png: 'PNG Image',
    jpg: 'JPEG Image',
    jpeg: 'JPEG Image',
    gif: 'GIF Image',
    svg: 'SVG Image',
    zip: 'ZIP Archive',
    rar: 'RAR Archive',
    '7z': '7Z Archive',
    txt: 'Text File',
    md: 'Markdown File',
    json: 'JSON File',
    xml: 'XML File',
  };

  return labels[extension] || 'File';
}
