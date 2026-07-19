import type {
  GeminiModelId,
  ImageModelId,
  OpenAIModelId,
  ProviderId,
} from "@/types/generation";

export type ModelDefinition = {
  id: ImageModelId;
  provider: ProviderId;
  label: string;
  description: string;
};

export const MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: "gpt-image-2",
    provider: "openai",
    label: "GPT Image 2",
    description: "높은 입력 충실도와 정밀한 이미지 편집",
  },
  {
    id: "gemini-3.1-flash-image",
    provider: "gemini",
    label: "Nano Banana 2",
    description: "속도·비용·품질의 균형이 좋은 기본 모델",
  },
  {
    id: "gemini-3-pro-image",
    provider: "gemini",
    label: "Nano Banana Pro",
    description: "복잡한 지시와 전문 에셋 제작에 적합",
  },
];

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderId, ImageModelId> = {
  openai: "gpt-image-2",
  gemini: "gemini-3.1-flash-image",
};

export function getModelsForProvider(provider: ProviderId) {
  return MODEL_DEFINITIONS.filter((model) => model.provider === provider);
}

export function isProvider(value: string): value is ProviderId {
  return value === "openai" || value === "gemini";
}

export function isAllowedModel(
  provider: ProviderId,
  value: string,
): value is ImageModelId {
  return MODEL_DEFINITIONS.some(
    (model) => model.provider === provider && model.id === value,
  );
}

export function isOpenAIModel(value: string): value is OpenAIModelId {
  return value === "gpt-image-2";
}

export function isGeminiModel(value: string): value is GeminiModelId {
  return value === "gemini-3.1-flash-image" || value === "gemini-3-pro-image";
}
