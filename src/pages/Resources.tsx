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
      link: '/resources/mix-designs',
      content: {
        introduction: 'Concrete mix design is the process of determining the right proportions of cement, water, aggregates, and admixtures to achieve desired properties in both fresh and hardened concrete.',
        sections: [
          {
            title: 'Basic Mix Components',
            content: 'The four basic ingredients in concrete are: Portland cement, water, fine aggregates (sand), and coarse aggregates (gravel or crushed stone). Each component plays a crucial role in the final product.',
            subsections: [
              {
                title: 'Portland Cement',
                content: 'The binding agent that holds concrete together. Different types are available for various applications.'
              },
              {
                title: 'Aggregates',
                content: 'Make up 60-75% of concrete volume. Quality and gradation significantly impact strength.'
              },
              {
                title: 'Water',
                content: 'Activates cement hydration. The water-cement ratio is crucial for strength and workability.'
              }
            ]
          },
          {
            title: 'Mix Design Methods',
            content: 'Several established methods exist for proportioning concrete mixes:',
            subsections: [
              {
                title: 'ACI Method',
                content: 'Most widely used in North America, based on ACI 211.1 standard.'
              },
              {
                title: 'British Method (DOE)',
                content: 'Popular in UK and Commonwealth countries.'
              },
              {
                title: 'Indian Standard Method',
                content: 'Based on IS 10262, widely used in South Asia.'
              }
            ]
          }
        ]
      }
    },
    {
      title: 'Weather Effects on Concrete Curing',
      description: 'Discover how weather conditions affect concrete curing and what steps you can take to ensure proper curing in hot, cold, or wet conditions.',
      imageUrl: 'https://images.pexels.com/photos/1463530/pexels-photo-1463530.jpeg',
      link: '/resources/weather-effects',
      content: {
        introduction: 'Weather conditions significantly impact concrete curing and final strength. Understanding these effects is crucial for successful concrete placement.',
        sections: [
          {
            title: 'Hot Weather Concreting',
            content: 'High temperatures accelerate hydration and can lead to rapid moisture loss.',
            subsections: [
              {
                title: 'Temperature Effects',
                content: 'Every 10°F increase in temperature can reduce set time by up to 30%.'
              },
              {
                title: 'Preventive Measures',
                content: 'Using ice water, retarders, and proper curing compounds.'
              }
            ]
          },
          {
            title: 'Cold Weather Concreting',
            content: 'Low temperatures slow hydration and can lead to strength development issues.',
            subsections: [
              {
                title: 'Freezing Prevention',
                content: 'Concrete must be protected from freezing for at least 24 hours after placement.'
              },
              {
                title: 'Heating Methods',
                content: 'Using heated water, insulation blankets, and enclosures.'
              }
            ]
          }
        ]
      }
    },
    {
      title: 'Reinforcement Techniques',
      description: 'Explore different reinforcement methods for concrete structures, including rebar placement, fiber reinforcement, and mesh installation.',
      imageUrl: 'https://images.pexels.com/photos/1451958/pexels-photo-1451958.jpeg',
      link: '/resources/reinforcement',
      content: {
        introduction: 'Proper reinforcement is essential for concrete structures to resist tensile forces and prevent cracking.',
        sections: [
          {
            title: 'Steel Reinforcement',
            content: 'Traditional rebar remains the most common reinforcement method.',
            subsections: [
              {
                title: 'Rebar Grades',
                content: 'Understanding different strength grades and their applications.'
              },
              {
                title: 'Placement Guidelines',
                content: 'Proper spacing, coverage, and lap splice requirements.'
              }
            ]
          },
          {
            title: 'Alternative Reinforcement',
            content: 'Modern alternatives to traditional steel reinforcement.',
            subsections: [
              {
                title: 'Fiber Reinforcement',
                content: 'Steel, synthetic, and natural fibers for crack control.'
              },
              {
                title: 'Welded Wire Mesh',
                content: 'Pre-fabricated wire mesh for slabs and walls.'
              }
            ]
          }
        ]
      }
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