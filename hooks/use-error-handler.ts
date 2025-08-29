import { useState, useCallback } from 'react';
import { createAppError, logError, type AppError } from '@/lib/error-handler';
import { toast } from '@/hooks/use-toast';

export function useErrorHandler() {
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback((error: unknown, context?: string) => {
    const appError = createAppError(error);
    logError(appError, context);
    setError(appError);

    // Show toast notification
    toast({
      title: appError.message,
      description: appError.details,
      variant: 'destructive',
    });

    return appError;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const withErrorHandling = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      context?: string,
      showLoading: boolean = true
    ): Promise<T | null> => {
      try {
        if (showLoading) setIsLoading(true);
        clearError();
        
        const result = await asyncFn();
        return result;
      } catch (error) {
        handleError(error, context);
        return null;
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [handleError, clearError]
  );

  return {
    error,
    isLoading,
    handleError,
    clearError,
    withErrorHandling,
  };
}