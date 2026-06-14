import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { goToAppAuth } from '../../config/brand';
import { useAuth } from '../../hooks/useAuth';
import ResourceCard from '../../components/resources/ResourceCard';
import ConcreteChat from '../../components/ConcreteChat';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { CONCRETE_RESOURCE_ITEMS } from '../../features/resources/resourceCatalog';
import finishConcreteImage from '../../assets/images/finishconcrete.jpg';
import rebarImage from '../../assets/images/rebar.jpg';
import mixingImage from '../../assets/images/mixing.jpg';
import crackImage from '../../assets/images/crack.jpg';
import admixImage from '../../assets/images/admix.jpg';
import libraryImage from '../../assets/images/library.webp';
import { PREMIUM_PANEL } from '../../theme/appTheme';

const CONCRETE_ITEM_IMAGES: Record<string, string> = {
  'mix-designs': mixingImage,
  'weather-effects':
    'https://images.pexels.com/photos/1463530/pexels-photo-1463530.jpeg',
  reinforcement: rebarImage,
  'proper-finishing': finishConcreteImage,
  'common-problems': crackImage,
  admixtures: admixImage,
  'external-resources': libraryImage,
};

interface ConcreteResourcesPageProps {
  chatStore: {
    isVisible: boolean;
    setIsVisible: (visible: boolean) => void;
  };
}

export default function ConcreteResourcesPage({ chatStore }: ConcreteResourcesPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    chatStore.setIsVisible(!showChat);
    return () => chatStore.setIsVisible(true);
  }, [showChat, chatStore]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleChatClick = () => {
    if (!user) {
      goToAppAuth('/login', navigate);
    } else {
      setShowChat(true);
    }
  };

  const breadcrumb = (
    <>
      <Link to="/resources" className="hover:text-cyan-700 dark:hover:text-cyan-400">
        Resources
      </Link>
      <span className="mx-1.5 text-slate-400">/</span>
      <span className="text-slate-700 dark:text-slate-300">Concrete</span>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <AppPage data-testid="concrete-resources-page">
        <PageHeader
          breadcrumb={breadcrumb}
          title="Concrete Resources"
          subtitle="Concrete mix, curing, reinforcement, placement, and finishing references."
          className="mb-6"
        />

        <Button
          variant="ghost"
          onClick={() => navigate('/resources')}
          icon={<ArrowLeft size={20} />}
          className="mb-6 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          Back to Resources
        </Button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <motion.div
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.08 },
                },
              }}
              initial="hidden"
              animate="visible"
            >
              {CONCRETE_RESOURCE_ITEMS.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{
                    hidden: { y: 16, opacity: 0 },
                    visible: {
                      y: 0,
                      opacity: 1,
                      transition: { type: 'spring', stiffness: 100, damping: 14 },
                    },
                  }}
                >
                  <ResourceCard
                    title={item.title}
                    description={item.description}
                    imageUrl={CONCRETE_ITEM_IMAGES[item.id] ?? libraryImage}
                    link={item.route ?? '#'}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <div className={`${PREMIUM_PANEL} p-6`}>
              <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">
                Featured articles
              </h2>
              <ul className="space-y-3">
                {CONCRETE_RESOURCE_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        window.scrollTo(0, 0);
                        if (item.route) navigate(item.route);
                      }}
                      className="block w-full rounded-md p-2 text-left transition-colors hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
                    >
                      <span className="font-medium text-cyan-700 dark:text-cyan-400">
                        {item.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-cyan-200/80 bg-cyan-50/90 p-6 dark:border-cyan-900/50 dark:bg-cyan-950/40">
              <h2 className="mb-3 text-xl font-semibold text-cyan-950 dark:text-cyan-100">
                Need help?
              </h2>
              <p className="mb-4 text-sm text-cyan-900/90 dark:text-cyan-200/90">
                {user
                  ? 'Questions about concrete calculations or techniques? Chat with our assistant.'
                  : 'Sign in to chat and get personalized concrete guidance.'}
              </p>
              <Button onClick={handleChatClick} className="w-full">
                {user ? 'Chat with an Expert' : 'Sign in to Chat'}
              </Button>
            </div>
          </div>
        </div>

        {showChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="h-[min(36rem,90vh)] w-full max-w-[520px]">
              <ConcreteChat isModal onClose={() => setShowChat(false)} />
            </div>
          </div>
        )}
      </AppPage>
    </motion.div>
  );
}
