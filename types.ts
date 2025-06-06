
export enum ProductType {
  BOX = 'Коробка',
  PAPER_BAG = 'Пакет бумажный',
  TISSUE_PAPER = 'Тишью бумага',
}

export enum BoxType {
  SELF_ASSEMBLY = 'Самосборная',
  LID_BOTTOM = 'Крышка-дно',
  AIRPLANE = 'Самолет (конверт)',
  MAGNETIC_CLOSURE = 'На магнитном клапане',
  DRAWER = 'Выдвижная (пенал)',
  OTHER = 'Другой тип коробки'
}

export enum Material {
  COATED_PAPER = 'Мелованная бумага',
  KRAFT_PAPER = 'Крафт-бумага',
  DESIGN_PAPER = 'Дизайнерская/спецбумага',
  CORRUGATED_CARDBOARD = 'Гофрокартон (микрогофро, трехслойный и т.д.)',
  CARDBOARD_SOLID = 'Картон (целлюлозный, макулатурный)',
  OTHER = 'Другой материал'
}

export enum PrintType {
  OFFSET = 'Офсетная печать',
  DIGITAL = 'Цифровая печать',
  SILKSCREEN = 'Шелкография',
  FLEXOGRAPHY = 'Флексография',
  NO_PRINT = 'Без печати',
  OTHER = 'Другой тип печати'
}

export enum FinishType {
  MATTE_LAMINATION = 'Матовая ламинация',
  GLOSS_LAMINATION = 'Глянцевая ламинация',
  SOFT_TOUCH_LAMINATION = 'Soft-touch ламинация',
  GOLD_FOIL = 'Тиснение золотом',
  SILVER_FOIL = 'Тиснение серебром',
  COLOR_FOIL = 'Тиснение цветной фольгой',
  BLIND_EMBOSSING = 'Слепое тиснение (блинт)',
  CONGREVE_EMBOSSING = 'Конгревное тиснение',
  SPOT_UV_VARNISH = 'Выборочный УФ-лак',
  FULL_UV_VARNISH = 'Полный УФ-лак',
  OTHER = 'Другая отделка'
}

export enum HandleType {
  CORD = 'Шнурок (полипропиленовый, хлопковый)',
  SATIN_RIBBON = 'Лента атласная',
  REP_RIBBON = 'Лента репсовая',
  COTTON_RIBBON = 'Лента хлопковая',
  PAPER_TWISTED = 'Бумажная крученая ручка',
  DIE_CUT = 'Вырубная ручка',
  OTHER = 'Другой тип ручек'
}

export enum HandleAttachment {
  GLUED_IN = 'Вклеенные',
  EYELETS = 'Люверсы',
  KNOTTED_ENDS = 'Узелки (для шнурков)',
  OTHER = 'Другой способ крепления'
}

export interface FormData {
  parsedUserRequest?: string; // To store the raw user input
  productType?: ProductType | string; // Allow string initially from Gemini
  specificBoxType?: BoxType | string;
  material?: Material | string;
  specificMaterialName?: string;
  materialDensity?: number | string | null; // Allow string for "250 грамм"
  width?: number | string;
  height?: number | string;
  depth?: number | string; // Depth might not be applicable for tissue paper
  quantity?: number | string;
  printColorsOuter?: string;
  printColorsInner?: string;
  printType?: PrintType | string;
  finishes?: (FinishType | string)[] | string; // Allow string for comma separated list
  handleType?: HandleType | string;
  handleAttachment?: HandleAttachment | string;
  fittings?: string;
  additionalInfo?: string;
}

export interface PackagingCostResponse {
  fullText: string;
  estimatedCostPerUnit: number | null;
  totalEstimatedCost: number | null;
  estimatedCostPerUnitLower?: number | null;
  estimatedCostPerUnitUpper?: number | null;
  totalEstimatedCostLower?: number | null;
  totalEstimatedCostUpper?: number | null;
}

export interface KnowledgeBaseEntry {
  id: number;
  productType: ProductType;
  specificType?: string;
  quantity: number;
  pricePerUnitCNY: number;
  width_mm: number;
  height_mm: number;
  depth_mm?: number; // Depth is optional here too
  material: string;
  materialDensity_gsm?: number;
  printColorsOuter?: string;
  printColorsInner?: string;
  printType?: PrintType;
  finish1?: FinishType;
  finish2?: FinishType;
  handlesType?: HandleType;
  handleAttachment?: HandleAttachment;
  fittings?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'error' | 'info';
  timestamp: Date;
  isLoading?: boolean; // To show spinner within a message
}

export type QuestionType =
  | 'ProductType' | 'BoxType' | 'Material' | 'PrintType' | 'FinishType' | 'HandleType' | 'HandleAttachment'
  | 'number' | 'number_optional' | 'string' | 'string_optional' | 'boolean' | 'finishes_list' | 'confirm' | 'info';

export interface Question {
  id: string;
  field?: keyof FormData;
  prompt: (formData: Partial<FormData>) => string;
  type: QuestionType;
  options?: readonly string[];
  required?: boolean;
  condition?: (formData: Partial<FormData>) => boolean;
  nextQuestionId?: string | ((value: any, formData: Partial<FormData>) => string);
  isMultiStage?: boolean;
}

export type AppStep = 
  | 'awaiting_description' 
  | 'parsing_description' 
  | 'awaiting_confirmation' 
  | 'calculating_cost' 
  | 'displaying_result'
  | 'awaiting_feedback_or_new_order' // New state for handling feedback or new order
  | 'processing_correction' // New state for when Gemini is parsing correction
  | 'error_state';
