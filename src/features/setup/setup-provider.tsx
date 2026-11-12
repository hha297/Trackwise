import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/auth-provider';
import { fetchProfile } from '@/features/goals/api';
import { reportError } from '@/lib/errors/report-error';
import { queryClient } from '@/lib/query/query-client';

import { completeSetup, fetchSetupProgress, saveSetupProgress } from './api';
import {
  EMPTY_SETUP_ANSWERS,
  nextStep,
  previousStep,
  stepIndex,
  type SetupAnswers,
  type SetupStepId,
} from './types';

type SetupContextValue = {
  ready: boolean;
  step: SetupStepId;
  answers: SetupAnswers;
  saving: boolean;
  completing: boolean;
  error: string | null;
  progress: { index: number; total: number };
  patchAnswers: (patch: Partial<SetupAnswers>) => void;
  goNext: (patch?: Partial<SetupAnswers>) => Promise<void>;
  goBack: () => Promise<void>;
  goToStep: (step: SetupStepId) => Promise<void>;
  finish: () => Promise<void>;
  clearError: () => void;
};

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<SetupStepId>('goal');
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_SETUP_ANSWERS);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) {
      const timer = setTimeout(() => {
        if (active) setReady(true);
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }

    void (async () => {
      try {
        const progress = await fetchSetupProgress(userId);
        if (!active) return;
        if (progress) {
          setStep(progress.currentStep);
          setAnswers(progress.answers);
        }
      } catch (err) {
        reportError(err, { area: 'setup', action: 'load-progress' });
      } finally {
        if (active) {
          setReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const persist = useCallback(
    async (nextStep: SetupStepId, nextAnswers: SetupAnswers) => {
      if (!userId) {
        throw new Error(t('goalsEdit.signInRequired'));
      }
      setSaving(true);
      setError(null);
      try {
        await saveSetupProgress(userId, nextStep, nextAnswers);
      } catch (err) {
        reportError(err, { area: 'setup', action: 'save-progress' });
        setError(err instanceof Error ? err.message : t('setup.saveFailed'));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [t, userId],
  );

  const patchAnswers = useCallback((patch: Partial<SetupAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
  }, []);

  const goNext = useCallback(
    async (patch?: Partial<SetupAnswers>) => {
      const merged = patch ? { ...answers, ...patch } : answers;
      if (patch) {
        setAnswers(merged);
      }
      const upcoming = nextStep(step, merged);
      if (!upcoming) {
        return;
      }
      // When entering maintain, sync target weight.
      if (upcoming === 'summary' && merged.goalType === 'maintain_weight' && merged.weightKg) {
        merged.targetWeightKg = merged.weightKg;
        merged.pace = null;
        setAnswers(merged);
      }
      await persist(upcoming, merged);
      setStep(upcoming);
    },
    [answers, persist, step],
  );

  const goBack = useCallback(async () => {
    const prior = previousStep(step, answers);
    if (!prior) return;
    await persist(prior, answers);
    setStep(prior);
  }, [answers, persist, step]);

  const goToStep = useCallback(
    async (target: SetupStepId) => {
      await persist(target, answers);
      setStep(target);
    },
    [answers, persist],
  );

  const finish = useCallback(async () => {
    if (!userId) {
      throw new Error(t('goalsEdit.signInRequired'));
    }
    setCompleting(true);
    setError(null);
    try {
      await completeSetup(userId, answers);
      // Write fresh profile into cache immediately so bootstrap can leave 'setup'.
      const profile = await fetchProfile(userId);
      queryClient.setQueryData(['profile', userId], profile);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['goal'] }),
        queryClient.invalidateQueries({ queryKey: ['bootstrap', userId] }),
        queryClient.invalidateQueries({ queryKey: ['body-measurements'] }),
      ]);
    } catch (err) {
      reportError(err, { area: 'setup', action: 'complete' });
      setError(err instanceof Error ? err.message : t('setup.finishFailed'));
      throw err;
    } finally {
      setCompleting(false);
    }
  }, [answers, t, userId]);

  const progress = stepIndex(step, answers);

  const value = useMemo(
    () => ({
      ready,
      step,
      answers,
      saving,
      completing,
      error,
      progress,
      patchAnswers,
      goNext,
      goBack,
      goToStep,
      finish,
      clearError: () => setError(null),
    }),
    [
      ready,
      step,
      answers,
      saving,
      completing,
      error,
      progress,
      patchAnswers,
      goNext,
      goBack,
      goToStep,
      finish,
    ],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupContextValue {
  const value = useContext(SetupContext);
  if (!value) {
    throw new Error('useSetup must be used within SetupProvider');
  }
  return value;
}
