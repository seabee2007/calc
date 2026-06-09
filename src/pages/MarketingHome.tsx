import { motion } from 'framer-motion';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { signInWithProvider } from '../lib/oauthAuth';
import { AUTH_ACCENT } from '../components/auth/authBrandTheme';
import {
  MARKETING_FEATURE_CARDS,
  MARKETING_HERO_SUBTITLE,
  MARKETING_HERO_TITLE,
  MARKETING_SUITE_SECTION_TITLE,
  MARKETING_WORKFLOW,
} from './marketingHomeContent';

export default function MarketingHome() {
  const navigate = useNavigate();
  const { user, isEmployee } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const openWorkspace = () => {
    if (isEmployee) {
      navigate('/employee/dashboard');
      return;
    }
    navigate('/projects');
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleError(null);
      setGoogleLoading(true);
      await signInWithProvider('google');
    } catch {
      setGoogleError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 overflow-x-hidden pb-8 sm:space-y-16 sm:pb-12">
      <motion.section
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/55 px-4 py-10 text-center shadow-2xl backdrop-blur-md sm:px-8 sm:py-14"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={`pointer-events-none absolute inset-0 ${AUTH_ACCENT.heroGradient}`} />
        <div className="relative">
          <p className={`mb-4 text-xs font-semibold uppercase tracking-[0.24em] sm:text-sm ${AUTH_ACCENT.brandLabel}`}>
            {MARKETING_WORKFLOW}
          </p>
          <h1 className="mx-auto max-w-4xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            {MARKETING_HERO_TITLE}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
            {MARKETING_HERO_SUBTITLE}
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {user ? (
              <Button
                size="lg"
                variant="accent"
                fullWidth
                className="sm:w-auto"
                onClick={openWorkspace}
                icon={<LayoutDashboard size={20} />}
              >
                Open workspace
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="accent"
                  fullWidth
                  className="sm:w-auto"
                  onClick={() => navigate('/signup')}
                  icon={<LayoutDashboard size={20} />}
                >
                  Get started
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  fullWidth
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                  onClick={() => navigate('/login')}
                >
                  Sign in
                </Button>
                
              </>
            )}
          </div>
          {!user && googleError ? (
            <p className="relative mt-4 text-sm text-red-300" role="alert">
              {googleError}
            </p>
          ) : null}
        </div>
      </motion.section>

      <section className="px-1 sm:px-0">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{MARKETING_SUITE_SECTION_TITLE}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Professional construction project management software for estimating, planning, scheduling,
            documents, and field execution.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {MARKETING_FEATURE_CARDS.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={{
                  hidden: { y: 16, opacity: 0 },
                  visible: { y: 0, opacity: 1 },
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(feature.path)}
                  className={AUTH_ACCENT.featureCardHover}
                >
                  <div className={AUTH_ACCENT.featureIconBox}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">
                    {feature.description}
                  </p>
                  <span className={AUTH_ACCENT.featureLink}>
                    Learn more
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    </div>
  );
}
