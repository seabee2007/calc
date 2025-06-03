import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ResourceCard from '../components/resources/ResourceCard';
import ConcreteChat from '../components/ConcreteChat';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import finishConcreteImage from '../assets/images/finishconcrete.jpg';
import rebarImage from '../assets/images/rebar.jpg';
import mixingImage from '../assets/images/mixing.jpg';
import crackImage from '../assets/images/crack.jpg';
import admixImage from '../assets/images/admix.jpg';
import libraryImage from '../assets/images/library.webp';

interface ResourcesProps {
  chatStore: {
    isVisible: boolean;
    setIsVisible: (visible: boolean) => void;
  };
}

const Resources: React.FC<ResourcesProps> = ({ chatStore }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    chatStore.setIsVisible(!showChat);
    return () => chatStore.setIsVisible(true);
  }, [showChat, chatStore]);
  
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const resources = [
    {
      title: 'Understanding Concrete Mix Designs',
      description: 'Learn about different concrete mix designs and how to choose the right one for your project based on strength requirements and environmental conditions.',
      imageUrl: mixingImage,
      link: '/resources/mix-designs'
    },
    {
      title: 'Weather Effects on Concrete Curing',
      description: 'Discover how weather conditions affect concrete curing and what steps you can take to ensure proper curing in hot, cold, or wet conditions.',
      imageUrl: 'https://images.pexels.com/photos/1463530/pexels-photo-1463530.jpeg',
      link: '/resources/weather-effects'
    },
    {
      title: 'Reinforcement Techniques',
      description: 'Explore different reinforcement methods for concrete structures, including rebar placement, fiber reinforcement, and mesh installation.',
      imageUrl: rebarImage,
      link: '/resources/reinforcement'
    },
    {
      title: 'Proper Concrete Finishing Methods',
      description: 'Learn about the different techniques for finishing concrete surfaces, from basic troweling to decorative finishes and surface treatments.',
      imageUrl: finishConcreteImage,
      link: '/resources/proper-finishing'
    },
    {
      title: 'Common Concrete Problems',
      description: 'Identify and prevent common concrete issues such as cracking, scaling, discoloration, and surface defects through proper preparation and techniques.',
      imageUrl: crackImage,
      link: '/resources/common-problems'
    },
    {
      title: 'Admixtures and Their Uses',
      description: 'Understand the various concrete admixtures available and how they can improve workability, strength, and durability in different conditions.',
      imageUrl: admixImage,
      link: '/resources/admixtures'
    },
    {
      title: 'External Resources & Standards',
      description: 'Access industry standards, certifications, and educational resources from leading organizations in concrete construction.',
      imageUrl: libraryImage,
      link: '/resources/external-resources'
    }
  ];

  const handleChatClick = () => {
    if (!user) {
      navigate('/login');
    } else {
      setShowChat(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Concrete Resources
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Helpful guides, tips, and reference materials for concrete work
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
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
              {resources.map((resource, index) => (
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
                  onClick={() => navigate(resource.link)}
                >
                  <ResourceCard
                    title={resource.title}
                    description={resource.description}
                    imageUrl={resource.imageUrl}
                    link={resource.link}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Latest Updates</h2>
              <ul className="space-y-4">
                {resources.map((resource, index) => (
                  <li key={index}>
                    <button 
                      onClick={() => navigate(resource.link)}
                      className="block w-full text-left hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-md p-3 transition-colors"
                    >
                      <h3 className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                        {resource.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Updated 2 days ago</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-blue-50/90 dark:bg-blue-900/50 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4">Need Help?</h2>
              <p className="text-blue-700 dark:text-blue-300 mb-4">
                {user 
                  ? "Have questions about concrete calculations or techniques? Our team is here to help!"
                  : "Sign in to chat with our concrete experts and get personalized assistance."}
              </p>
              <Button 
                onClick={handleChatClick}
                className="w-full"
              >
                {user ? "Chat with an Expert" : "Sign in to Chat"}
              </Button>
            </div>
          </div>
        </div>

        {showChat && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl h-[600px] relative">
              <button 
                onClick={() => setShowChat(false)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 z-10"
              >
                <span className="text-xl font-bold">✕</span>
              </button>
              <div className="h-full">
                <ConcreteChat isModal onClose={() => setShowChat(false)} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Resources;