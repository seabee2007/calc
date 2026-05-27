import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calculator, Folder, Book, ArrowRight, CloudSun, LayoutDashboard } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const MarketingHome: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Operations dashboard',
      description:
        'Dashboard for placements, dispatch, weather risk, QC, and readiness scores',
      icon: <LayoutDashboard className="h-10 w-10 text-white" />,
      action: () => navigate('/signup'),
      gradient: 'from-slate-700 to-slate-900',
    },
    {
      title: 'Placement planner',
      description: 'ACI weather scoring, truck spacing, and ready-mix call sheets',
      icon: <CloudSun className="h-10 w-10 text-white" />,
      action: () => navigate('/pour-planner'),
      gradient: 'from-cyan-500 to-cyan-700',
    },
    {
      title: 'Precise calculations',
      description: 'Slabs, footers, columns, sidewalks — field-ready volumes',
      icon: <Calculator className="h-10 w-10 text-white" />,
      action: () => navigate('/calculator'),
      gradient: 'from-blue-500 to-blue-700',
    },
    {
      title: 'Project management',
      description: 'QC logs, truck tickets, jobsite addresses, and placement dates',
      icon: <Folder className="h-10 w-10 text-white" />,
      action: () => navigate('/projects'),
      gradient: 'from-indigo-500 to-indigo-700',
    },
    {
      title: 'Concrete resources',
      description: 'Guides for mix, finishing, and NAVFAC-style field workflows',
      icon: <Book className="h-10 w-10 text-white" />,
      action: () => navigate('/resources'),
      gradient: 'from-blue-500 to-blue-700',
    },
  ];

  return (
    <div className="space-y-12">
      <motion.section
        className="text-center py-12 px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.h1
          className="text-4xl sm:text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Concrete field operations
          <span className="text-cyan-400"> platform</span>
        </motion.h1>

        <motion.p
          className="text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          More than volume math — plan placements, manage dispatch call sheets, track QC,
          and score weather risk for military and commercial jobsites.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Button
            size="lg"
            onClick={() => navigate('/signup')}
            icon={<LayoutDashboard size={20} />}
          >
            Get started
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/login')}
            className="bg-white/10 backdrop-blur-sm"
          >
            Sign in
          </Button>
        </motion.div>
      </motion.section>

      <section className="py-8">
        <h2 className="text-2xl font-bold text-white drop-shadow mb-8 text-center">
          Built for the field
        </h2>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { y: 20, opacity: 0 },
                visible: { y: 0, opacity: 1 },
              }}
            >
              <Card
                className={`h-full p-6 text-center bg-gradient-to-br ${feature.gradient} hover:scale-[1.02] transition-all shadow-xl`}
                shadow="lg"
                hoverable
                clickable
                onClick={feature.action}
              >
                <div className="flex justify-center mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/90 mb-4 text-sm">{feature.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={feature.action}
                  icon={<ArrowRight size={16} />}
                  className="bg-white/10 text-white border-white/30"
                >
                  Explore
                </Button>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
};

export default MarketingHome;
