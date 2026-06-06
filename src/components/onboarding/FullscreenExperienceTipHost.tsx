import { useFullscreenExperienceTip } from '../../hooks/useFullscreenExperienceTip';
import FullscreenExperienceModal from './FullscreenExperienceModal';

export default function FullscreenExperienceTipHost() {
  const { isOpen, confirm } = useFullscreenExperienceTip();

  return <FullscreenExperienceModal isOpen={isOpen} onConfirm={confirm} />;
}
