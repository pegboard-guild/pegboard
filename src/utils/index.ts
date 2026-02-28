import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Format date for display
export const formatDate = (date: string | Date): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'MMM d, yyyy');
};

// Format relative time
export const formatRelativeTime = (date: string | Date): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

// Validate zipcode
export const isValidZipcode = (zipcode: string): boolean => {
  return /^\d{5}$/.test(zipcode);
};

// Format party affiliation
export const formatParty = (party: string | null): string => {
  switch (party) {
    case 'D':
      return 'Democrat';
    case 'R':
      return 'Republican';
    case 'I':
      return 'Independent';
    default:
      return party || 'Unknown';
  }
};

// Get party color
export const getPartyColor = (party: string | null): string => {
  switch (party) {
    case 'D':
      return '#2563eb'; // Blue
    case 'R':
      return '#dc2626'; // Red
    case 'I':
      return '#6b7280'; // Gray
    default:
      return '#6b7280';
  }
};

// Format vote
export const formatVote = (vote: string): string => {
  switch (vote) {
    case 'YES':
      return '✓ Yes';
    case 'NO':
      return '✗ No';
    case 'NOT_VOTING':
      return '— Not Voting';
    case 'PRESENT':
      return '○ Present';
    default:
      return vote;
  }
};

// Get vote color
export const getVoteColor = (vote: string): string => {
  switch (vote) {
    case 'YES':
      return '#16a34a'; // Green
    case 'NO':
      return '#dc2626'; // Red
    case 'NOT_VOTING':
    case 'PRESENT':
      return '#6b7280'; // Gray
    default:
      return '#6b7280';
  }
};

// Format sentiment percentage
export const formatSentiment = (percentage: number): string => {
  if (percentage > 0) return `+${percentage}%`;
  return `${percentage}%`;
};

// Get sentiment color
export const getSentimentColor = (percentage: number): string => {
  if (percentage > 30) return '#16a34a'; // Strong positive
  if (percentage > 0) return '#84cc16'; // Positive
  if (percentage === 0) return '#6b7280'; // Neutral
  if (percentage > -30) return '#f59e0b'; // Negative
  return '#dc2626'; // Strong negative
};

// Format chamber
export const formatChamber = (chamber: string): string => {
  return chamber.charAt(0).toUpperCase() + chamber.slice(1);
};

// Format bill ID for display
export const formatBillId = (billId: string): string => {
  return billId.replace('-', ' ');
};

// Generate session ID
export const generateSessionId = (): string => {
  return `pegboard_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create session ID
export const getSessionId = (): string => {
  let sessionId = localStorage.getItem('pegboard_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem('pegboard_session_id', sessionId);
  }
  return sessionId;
};

// Save zipcode to localStorage
export const saveZipcode = (zipcode: string): void => {
  localStorage.setItem('pegboard_zipcode', zipcode);
};

// Get saved zipcode
export const getSavedZipcode = (): string | null => {
  return localStorage.getItem('pegboard_zipcode');
};

// Clear user data
export const clearUserData = (): void => {
  localStorage.removeItem('pegboard_zipcode');
  // Keep session ID for tracking
};

// Truncate text
export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength).trim() + '...';
};

// Format phone number
export const formatPhone = (phone: string | null): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

// Get alignment label
export const getAlignmentLabel = (score: number): string => {
  if (score >= 80) return 'Strongly Aligned';
  if (score >= 60) return 'Aligned';
  if (score >= 40) return 'Somewhat Aligned';
  if (score >= 20) return 'Misaligned';
  return 'Strongly Misaligned';
};

// Get alignment color
export const getAlignmentColor = (score: number): string => {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#dc2626';
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};