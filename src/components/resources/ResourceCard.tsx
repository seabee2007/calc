import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
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
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="h-full overflow-hidden" shadow="md">
        <div className="relative h-48 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
        
        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">{description}</p>
          
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            Read More
            <ExternalLink className="ml-1 h-4 w-4" />
          </a>
        </div>
      </Card>
    </motion.div>
  );
};

export default ResourceCard;