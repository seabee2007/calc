import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import AuthPageBackground from './AuthPageBackground';
import {
  AUTH_ACCENT,
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from './authBrandTheme';

export { authInputClassName, authLinkClassName, authPrimaryButtonClassName };

export const AUTH_FEATURES = [
  'Estimates and bid planning',
  'Proposals and client-ready documents',
  'Project schedules and CPM logic',
  'Field-ready project tracking',
] as const;

const easeOut = [0.16, 1, 0.3, 1] as const;

const fadeUpVariant = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOut },
  },
};

const backButtonMotion = {
  initial: fadeUpVariant.hidden,
  animate: fadeUpVariant.visible,
  transition: { duration: 0.45, ease: easeOut },
};

const marketingMotion = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.45, ease: easeOut, delay: 0.08 },
};

const cardMotion = {
  initial: { opacity: 0, x: 24, y: 12 },
  animate: { opacity: 1, x: 0, y: 0 },
  transition: { duration: 0.45, ease: easeOut, delay: 0.12 },
};

const contentStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.18,
    },
  },
};

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const navigate = useNavigate();

  return (
    <main className="auth-page relative min-h-[100dvh] overflow-x-hidden overflow-y-auto text-white">
      <AuthPageBackground />

      <div
        className="relative z-10 px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8"
        style={{
          paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <motion.div {...backButtonMotion}>
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            icon={<ArrowLeft size={20} />}
            className={AUTH_ACCENT.backButton}
          >
            Back
          </Button>
        </motion.div>

        <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-6 sm:py-8 lg:flex-row lg:items-start lg:gap-16 lg:py-10">
          <motion.div
            className="hidden flex-1 lg:block lg:pt-4"
            initial={marketingMotion.initial}
            animate={marketingMotion.animate}
            transition={marketingMotion.transition}
          >
            <p className={AUTH_ACCENT.brandLabelDesktop}>Arden Project OS</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white xl:text-5xl">
              Professional construction project management software.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              Estimate work, build proposals, plan schedules, and manage projects from one connected
              workspace.
            </p>
            <ul className="mt-8 space-y-4">
              {AUTH_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-slate-200">
                  <span className={AUTH_ACCENT.checkIconWrapper} aria-hidden>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="relative w-full max-w-[480px] shrink-0 lg:mx-0 lg:pt-2"
            initial={cardMotion.initial}
            animate={cardMotion.animate}
            transition={cardMotion.transition}
          >
            <div className={AUTH_ACCENT.authCardGlow} aria-hidden />
            <motion.div
              className={AUTH_ACCENT.authCard}
              variants={contentStagger}
              initial="hidden"
              animate="visible"
            >
              <motion.div className="mb-8 text-center lg:text-left" variants={fadeUpVariant}>
                <p className={`${AUTH_ACCENT.brandLabelMobile} lg:hidden`}>Arden Project OS</p>
                <h2 className="mt-2 text-3xl font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
              </motion.div>
              <motion.div variants={fadeUpVariant}>{children}</motion.div>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-slate-950/75 px-3 text-slate-400">{label}</span>
      </div>
    </div>
  );
}

export function AuthAlert({
  children,
  variant = 'info',
}: {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
}) {
  const styles = {
    info: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    warning: AUTH_ACCENT.warningAlert,
    error: 'border-red-400/30 bg-red-500/10 text-red-100',
  }[variant];

  return (
    <div className={`mb-6 rounded-xl border p-3 text-sm ${styles}`}>{children}</div>
  );
}
