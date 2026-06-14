import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { CC_PAGE_HERO_SUBTITLE, CC_PAGE_HERO_TITLE } from '../../theme/pageTypography';
import { PREMIUM_PANEL } from '../../theme/appTheme';

interface ResourceArticleLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

const ResourceArticleLayout: React.FC<ResourceArticleLayoutProps> = ({
  title,
  subtitle,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/resources/concrete')}
            icon={<ArrowLeft size={20} />}
            className="mb-4 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            Back to Concrete Resources
          </Button>
          <h1 className={CC_PAGE_HERO_TITLE}>{title}</h1>
          <p className={CC_PAGE_HERO_SUBTITLE}>{subtitle}</p>
        </div>

        <div className="space-y-6">{children}</div>
      </div>
    </motion.div>
  );
};

export function ResourceArticleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${PREMIUM_PANEL} p-6`}>
      <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

export default ResourceArticleLayout;
