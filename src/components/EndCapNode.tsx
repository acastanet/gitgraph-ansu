import { memo } from 'react';
import { useGitStore } from '../store/useGitStore';

interface EndCapNodeProps {
  data: {
    color: string;
    branchName: string;
  };
}

const EndCapNode = ({ data }: EndCapNodeProps) => {
  const layoutDirection = useGitStore(state => state.layoutDirection);
  const isVertical = layoutDirection === 'vertical';

  return (
    <div
      title={`HEAD: ${data.branchName} (glissez pour allonger la lane)`}
      className="rounded-full shadow"
      style={{
        width: 12,
        height: 12,
        backgroundColor: data.color,
        border: `2px solid ${data.color}`,
        cursor: isVertical ? 'ns-resize' : 'ew-resize',
      }}
    />
  );
};

export default memo(EndCapNode);
