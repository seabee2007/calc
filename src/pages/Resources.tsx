import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ResourceCard from '../components/resources/ResourceCard';

const Resources: React.FC = () => {
  const navigate = useNavigate();
  
  const resources = [
    {
      title: 'Understanding Concrete Mix Designs',
      description: 'Learn about different concrete mix designs and how to choose the right one for your project based on strength requirements and environmental conditions.',
      imageUrl: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg',
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
      imageUrl: 'https://images.pexels.com/photos/1451958/pexels-photo-1451958.jpeg',
      link: '/resources/reinforcement'
    },
    {
      title: 'Proper Concrete Finishing Methods',
      description: 'Learn about the different techniques for finishing concrete surfaces, from basic troweling to decorative finishes and surface treatments.',
      imageUrl: 'https://images.pexels.com/photos/3762455/pexels-photo-3762455.jpeg',
      link: '/resources/proper-finishing'
    },
    {
      title: 'Common Concrete Problems',
      description: 'Identify and prevent common concrete issues such as cracking, scaling, discoloration, and surface defects through proper preparation and techniques.',
      imageUrl: 'https://images.pexels.com/photos/7113950/pexels-photo-7113950.jpeg',
      link: '/resources/common-problems'
    },
    {
      title: 'Admixtures and Their Uses',
      description: 'Understand the various concrete admixtures available and how they can improve workability, strength, and durability in different conditions.',
      imageUrl: 'https://images.pexels.com/photos/2422265/pexels-photo-2422265.jpeg',
      link: '/resources/admixtures'
    }
  ];

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
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Latest Updates</h2>
              <ul className="space-y-4">
                {resources.map((resource, index) => (
                  <li key={index}>
                    <button 
                      onClick={() => navigate(resource.link)}
                      className="block w-full text-left hover:bg-blue-50 rounded-md p-3 transition-colors"
                    >
                      
                      <h3 className="font-medium text-blue-600 hover:text-blue-800">
                        {resource.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Updated 2 days ago</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-4">Need Help?</h2>
              <p className="text-blue-700 mb-4">
                Have questions about concrete calculations or techniques? Our team is here to help!
              </p>
              <button 
                onClick={() => navigate('/contact')}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Resources;