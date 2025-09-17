
import React from 'react';
import { ResourceType } from '../types';
import { WoodIcon, ClayIcon, IronIcon, WarehouseIcon } from './Icons';

interface ResourceBarProps {
  resources: {
    [ResourceType.Wood]: number;
    [ResourceType.Clay]: number;
    [ResourceType.Iron]: number;
  };
  capacity: number;
}

const ResourceBar: React.FC<ResourceBarProps> = ({ resources, capacity }) => {
  const formatNumber = (num: number) => {
    return Math.floor(num).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  return (
    <div className="flex items-center space-x-2 md:space-x-4 bg-gray-900 bg-opacity-70 p-2 rounded-lg border border-gray-700">
      <div className="flex items-center" title="Holz">
        <WoodIcon className="h-6 w-6 text-yellow-700" />
        <span className="ml-1 md:ml-2 text-sm md:text-base font-bold">{formatNumber(resources.wood)}</span>
      </div>
       <div className="flex items-center" title="Lehm">
        <ClayIcon className="h-6 w-6 text-orange-500" />
        <span className="ml-1 md:ml-2 text-sm md:text-base font-bold">{formatNumber(resources.clay)}</span>
      </div>
       <div className="flex items-center" title="Eisen">
        <IronIcon className="h-6 w-6 text-gray-400" />
        <span className="ml-1 md:ml-2 text-sm md:text-base font-bold">{formatNumber(resources.iron)}</span>
      </div>
       <div className="flex items-center" title="Speicherkapazität">
        <WarehouseIcon className="h-6 w-6 text-blue-300" />
        <span className="ml-1 md:ml-2 text-sm md:text-base font-bold">{formatNumber(capacity)}</span>
      </div>
    </div>
  );
};

export default ResourceBar;
