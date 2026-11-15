type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Stable locale key for a stored English sentence. */
export function templateCopyKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 96);
}

function systemText(
  t: Translate,
  group: 'templateDescriptions' | 'templateVariations' | 'templateNotes',
  source: string,
): string {
  const translated = t(`workout.${group}.${templateCopyKey(source)}`, { defaultValue: '' });
  return translated || source;
}

/** Display name for a system template; custom templates keep their stored name. */
export function localizedTemplateName(
  t: Translate,
  name: string,
  options?: { isSystem?: boolean | null },
): string {
  if (options?.isSystem === false) return name;
  return t(`workout.templateNames.${name}`, { defaultValue: name });
}

export function localizedTemplateDescription(
  t: Translate,
  name: string,
  description: string | null | undefined,
  options?: { isSystem?: boolean | null },
): string {
  if (!description) return '';
  if (options?.isSystem === false) return description;
  const translated = t(`workout.templateDescriptions.${templateCopyKey(name)}`, {
    defaultValue: '',
  });
  return translated || description;
}

export function localizedVariationDescription(
  t: Translate,
  templateName: string,
  level: string,
  description: string | null | undefined,
  options?: { isSystem?: boolean | null },
): string {
  if (!description) return '';
  if (options?.isSystem === false) return description;
  const translated = t(
    `workout.templateVariations.${templateCopyKey(`${templateName} ${level}`)}`,
    { defaultValue: '' },
  );
  return translated || description;
}

export function localizedTemplateNote(
  t: Translate,
  note: string | null | undefined,
  options?: { isSystem?: boolean | null },
): string {
  if (!note) return '';
  if (options?.isSystem === false) return note;
  return systemText(t, 'templateNotes', note);
}

/** Comma-separated system equipment tags. Unknown tokens and custom templates stay as stored. */
export function localizedEquipmentSummary(
  t: Translate,
  summary: string | null | undefined,
  options?: { isSystem?: boolean | null },
): string {
  if (!summary) return '';
  if (options?.isSystem === false) {
    const preset = t(`workout.templateEquipment.${summary}`, { defaultValue: '' });
    return preset || summary;
  }
  return summary
    .split(',')
    .map((part) => {
      const token = part.trim();
      if (!token) return '';
      const translated = t(`workout.equipmentSummary.${token.toLowerCase()}`, { defaultValue: '' });
      return translated || token;
    })
    .filter(Boolean)
    .join(' · ');
}
