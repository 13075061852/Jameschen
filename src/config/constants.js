// Application-wide constants: storage keys, editor config, layout, limits.
// These are pure module-level values with no dependency on component state.

export const STORAGE_KEY = 'personal-workflow-manager-v1';
export const CUSTOMER_DB_NAME = 'personal-workflow-manager-db';
export const CUSTOMER_DB_STORE = 'records';
export const CUSTOMER_ASSET_STORE = 'assets';
export const LAYOUT_STORAGE_KEY = 'personal-workflow-manager-layout-v1';
export const VIEW_STATE_STORAGE_KEY = 'personal-workflow-manager-view-state-v1';
export const GLOBAL_FIELD_LABELS_STORAGE_KEY = 'personal-workflow-manager-global-field-labels-v1';
export const BACKUP_VERSION = 1;
export const CUSTOMER_GRADES = ['A', 'B', 'C', 'D'];
export const EDITOR_FONT_SIZES = ['12px', '14px', '16px', '18px', '22px', '28px', '36px'];
export const EDITOR_FONTS = [
  { label: 'Calibri', value: 'Calibri, "Open Sans", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '苹方', value: '"PingFang SC", sans-serif' },
  { label: '宋体', value: 'SimSun, serif' },
];
export const DEFAULT_EDITOR_FONT = EDITOR_FONTS[0]; // Calibri
export const EDITOR_TEXT_COLORS = ['#111111', '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed'];
export const EDITOR_BACKGROUND_COLORS = ['#fff7ad', '#fee2e2', '#dbeafe', '#dcfce7', '#f3e8ff', '#ffffff'];
export const DEFAULT_EDITOR_TEXT_COLOR = EDITOR_TEXT_COLORS[0];
export const DEFAULT_EDITOR_BACKGROUND_COLOR = EDITOR_BACKGROUND_COLORS[5];
export const INLINE_EDITOR_FORMAT_TAGS = new Set(['SPAN', 'FONT', 'B', 'STRONG', 'I', 'EM', 'U', 'A', 'MARK']);
export const EDITOR_ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const EDITOR_VIDEO_ACCEPT = 'video/*';
export const EDITOR_IMAGE_MIN_WIDTH = 80;
export const DEFAULT_LEFT_PANEL_WIDTH = 360;
export const DEFAULT_RIGHT_PANEL_WIDTH = 540;
export const COLLAPSED_PANEL_WIDTH = 48;
export const RESIZER_WIDTH = 10;
export const MIN_LEFT_PANEL_WIDTH = 330;
export const MIN_RIGHT_PANEL_WIDTH = 420;
export const MIN_CENTER_PANEL_WIDTH = 360;
export const LOCAL_STORAGE_SAFE_CUSTOMER_SIZE = 1_500_000;
export const CUSTOMER_SAVE_DEBOUNCE_MS = 900;
export const INITIAL_CUSTOMER_RENDER_LIMIT = 80;
export const CUSTOMER_RENDER_INCREMENT = 80;
export const COLLAPSED_CUSTOMER_RENDER_LIMIT = 120;
export const STORED_ASSET_PREFIX = 'dbasset:';
export const EDITOR_HISTORY_LIMIT = 120;
export const EDITOR_DRAGGABLE_OBJECT_SELECTOR = '.editorImageFrame, .editorVideoFrame, .editorAttachmentFrame';

export const gradeMap = {
  A: '非常优质',
  B: '优质',
  C: '良好',
  D: '一般',
};

export const seedCustomers = [];
