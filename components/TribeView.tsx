
import React from 'react';

const TribeView: React.FC = () => {
  return (
    <div className="bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-2xl border border-gray-700 backdrop-blur-sm text-center">
      <h2 className="text-3xl font-bold mb-4 text-yellow-300 font-medieval">Stamm</h2>
      <div className="w-full h-96 bg-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-600">
        <p className="text-gray-400 text-xl">Du gehörst noch keinem Stamm an.</p>
      </div>
      <div className="mt-6 flex justify-center space-x-4">
        <button className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded transition-colors duration-300">
          Stamm gründen
        </button>
        <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded transition-colors duration-300">
          Stamm beitreten
        </button>
      </div>
      <p className="mt-4 text-gray-300">Schließe dich mit anderen Spielern zusammen, um Schutz zu finden und Kriege zu führen.</p>
    </div>
  );
};

export default TribeView;
