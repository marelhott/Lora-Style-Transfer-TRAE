# 🚀 Neural Art Studio - Cursor Development Guide

## 📋 Aktuální Stav Projektu

**Projekt je nyní kompletně vyčištěný a připravený pro backend integraci!**

- ✅ **Velikost**: Pouze 7.4MB (bez node_modules)
- ✅ **Mock data**: Odstraněny konkrétní modely, zůstala jen struktura
- ✅ **Frontend**: Kompletně funkční UI s všemi komponentami
- ✅ **Database**: Připravené Convex schéma pro všechny entity
- ✅ **Dokumentace**: Kompletní dokumentace a audit
- ✅ **GitHub Ready**: Připraveno pro push na GitHub

## 🎯 Priority pro Cursor Development

### 1. Backend API Integrace (Nejvyšší priorita)

**Aktuální stav**: `app/page.tsx` používá mock zpracování s setTimeout
**Potřeba**: Skutečné AI API integrace

```typescript
// Nahradit tuto mock funkci kolem řádku 214
const handleStartProcessing = async () => {
  // TODO: Nahradit skutečným AI processing API
  // Doporučeno: Replicate API nebo Hugging Face Inference
}
```

**Doporučené API služby:**
- **Replicate API**: `https://replicate.com/` - nejjednodušší integrace
- **Hugging Face**: `https://huggingface.co/inference-api`
- **RunPod**: `https://runpod.io/` - pro vlastní modely

### 2. Model Management (Vysoká priorita)

**Aktuální stav**: Prázdné mock data v `mockModels` array
**Potřeba**: Skutečný upload a správa modelů

```typescript
// V app/page.tsx kolem řádku 30
const mockModels: AIModel[] = [
  // Prázdné pole - modely budou přidány při backend integraci
]
```

**Co implementovat:**
- Upload .safetensors, .ckpt, .pt souborů
- Validace velikosti a formátu
- Metadata extrakce
- Storage v Convex
