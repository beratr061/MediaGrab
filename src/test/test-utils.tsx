import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '../components/ThemeProvider';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index';

interface WrapperProps {
  children: ReactNode;
}

const AllTheProviders = ({ children }: WrapperProps) => {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider defaultTheme="light" storageKey="mediagrab-theme">
        {children}
      </ThemeProvider>
    </I18nextProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
