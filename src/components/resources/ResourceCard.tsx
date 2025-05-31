import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';

interface ResourceCardProps {
  title: string;
  description: string;
  imageUrl: string;
  link: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  description,
  imageUrl,
  link
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // First scroll to top
    window.scrollTo(0, 0);
    // Then navigate
    navigate(link);
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
<<<<<<< HEAD
        className="h-full overflow-hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all" 
=======
        className="h-full overflow-hidden bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all" 
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
        shadow="md"
        hoverable
        clickable
        onClick={handleClick}
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
        
        <div className="p-5">
<<<<<<< HEAD
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 drop-shadow-sm">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">{description}</p>
          
          <button
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors"
=======
          <h3 className="text-lg font-semibold text-gray-900 mb-2 drop-shadow-sm">{title}</h3>
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">{description}</p>
          
          <button
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
          >
            Read More
            <ExternalLink className="ml-1 h-4 w-4" />
          </button>
        </div>
      </Card>
    </motion.div>
  );
};

export default ResourceCard;