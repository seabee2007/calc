import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  BookOpen,
  Truck,
  ClipboardCheck,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useMoreMenuStore } from '../../store/moreMenuStore';
import { useAuth } from '../../hooks/useAuth';

interface MoreItem {
  title: string;
  path: string;
  icon: LucideIcon;
}

const MORE_ITEMS: MoreItem[] = [
  { title: 'Settings', path: '/settings', icon: Settings },
  { title: 'Resources', path: '/resources', icon: BookOpen },
  { title: 'Dispatch', path: '/dispatch', icon: Truck },
  { title: 'QC', path: '/qc', icon: ClipboardCheck },
];

const MoreMenuModal: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen, close } = useMoreMenuStore();
  const { signOut } = useAuth();

  const handleNavigate = (path: string) => {
    close();
    navigate(path);
  };

  const handleSignOut = async () => {
    close();
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="More" size="md">
      <div className="space-y-2">
        {MORE_ITEMS.map(({ title, path, icon: Icon }) => (
          <button
            key={path}
            type="button"
            onClick={() => handleNavigate(path)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span className="font-medium">{title}</span>
          </button>
        ))}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            fullWidth
            onClick={handleSignOut}
            icon={<LogOut size={18} />}
            className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-600"
          >
            Sign out
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MoreMenuModal;
