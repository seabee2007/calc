import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calculator, Folder, Book, ArrowRight, CloudSun } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Home: React.FC = () => {
  const navigate = useNavigate();
  
  const features = [
    {
      title: 'Precise Calculations',
      description: 'Accurately estimate concrete needed for slabs, footers, columns, and sidewalks',
      icon: <Calculator className="h-10 w-10 text-white" />,
      action: () => navigate('/calculator'),
      gradient: 'from-blue-500 to-blue-700'
    },
    {
      title: 'Weather Integration',
      description: 'Get concrete mix recommendations based on real-time weather conditions',
      icon: <CloudSun className="h-10 w-10 text-white" />,
      action: () => navigate('/calculator', { state: { openWeatherModal: true } }),
      gradient: 'from-cyan-500 to-cyan-700'
    },
    {
      title: 'Project Management',
      description: 'Save and organize your projects for easy reference and future use',
      icon: <Folder className="h-10 w-10 text-white" />,
      action: () => navigate('/projects'),
      gradient: 'from-indigo-500 to-indigo-700'
    },
    {
      title: 'Concrete Resources',
      description: 'Access guides and resources for best practices in concrete work',
      icon: <Book className="h-10 w-10 text-white" />,
      action: () => navigate('/resources'),
      gradient: 'from-blue-500 to-blue-700'
    }
  ];
  
  return (
    <div className="space-y-12">
      {/* Hero Section */}
<<<<<<< HEAD
      <section className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
            Concrete Calculator Pro
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
            Professional concrete estimation tool with precise calculations, weather integration, and project management
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/calculator')}
              icon={<Calculator size={20} />}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Start Calculating
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => navigate('/resources')}
              icon={<Book size={20} />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-lg hover:shadow-xl"
            >
              Browse Resources
            </Button>
          </div>
        </motion.div>
      </section>
=======
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
          Concrete Calculations
          <span className="text-blue-400"> Made Simple</span>
        </motion.h1>
        
        <motion.p 
          className="text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Accurately estimate concrete for your projects with our easy-to-use calculator. 
          Get weather-based recommendations and save your projects for future reference.
        </motion.p>
        
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <Button 
            size="lg" 
            onClick={() => navigate('/calculator')}
            icon={<Calculator size={20} />}
            className="shadow-lg hover:shadow-xl transition-shadow"
          >
            Start Calculating
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => navigate('/resources')}
            icon={<Book size={20} />}
            className="shadow-lg hover:shadow-xl transition-shadow bg-white/10 backdrop-blur-sm"
          >
            Learn More
          </Button>
        </motion.div>
      </motion.section>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
      
      {/* Features Section */}
      <section className="py-8">
        <h2 className="text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-8 text-center">
          Key Features
        </h2>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate="visible"
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              variants={{
                hidden: { y: 20, opacity: 0 },
                visible: {
                  y: 0,
                  opacity: 1,
                  transition: {
                    type: 'spring',
                    stiffness: 100,
                    damping: 12
                  }
                }
              }}
              className="transform-gpu"
            >
              <Card 
                className={`h-full p-6 text-center bg-gradient-to-br ${feature.gradient} hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl`}
                shadow="lg"
                hoverable
                clickable
                onClick={feature.action}
              >
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 drop-shadow-sm">{feature.title}</h3>
                <p className="text-white/90 mb-4">{feature.description}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={feature.action}
                  icon={<ArrowRight size={16} />}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                >
                  Learn More
                </Button>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
};

export default Home;