'use client';

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface TimeAgoProps {
  date: Date | number;
  addSuffix?: boolean;
}

export function TimeAgo({ date, addSuffix = true }: TimeAgoProps) {
  const { i18n } = useTranslation('common');
  const isPT = i18n.language && i18n.language.startsWith('pt');

  const label = useMemo(() => {
    try {
      return formatDistanceToNow(date, { addSuffix, locale: isPT ? ptBR : enUS });
    } catch {
      return isPT ? 'agora mesmo' : 'Just now';
    }
  }, [addSuffix, date, isPT]);

  return <span suppressHydrationWarning>{label}</span>;
}
