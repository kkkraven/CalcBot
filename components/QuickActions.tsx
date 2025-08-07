import React from 'react';
import { Package, Box, FileText, History, Settings } from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  color: string;
}

interface QuickActionsProps {
  onTemplateSelect: (template: string) => void;
  onShowHistory: () => void;
  onShowStats: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ 
  onTemplateSelect, 
  onShowHistory, 
  onShowStats 
}) => {
  const quickActions: QuickAction[] = [
    {
      id: 'box-template',
      title: 'Коробка',
      description: 'Самосборная коробка',
      icon: <Box className="w-5 h-5" />,
      action: () => onTemplateSelect('Самосборная коробка, мелованная бумага 250г/м², размер 200x150x50мм, печать 4+0, тираж 1000шт'),
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'bag-template',
      title: 'Пакет',
      description: 'Бумажный пакет',
      icon: <Package className="w-5 h-5" />,
      action: () => onTemplateSelect('Бумажный пакет, крафт-бумага 120г/м², размер 300x200x80мм, печать 1+0, тиснение золотом, тираж 500шт'),
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'tissue-template',
      title: 'Тишью',
      description: 'Тишью бумага',
      icon: <FileText className="w-5 h-5" />,
      action: () => onTemplateSelect('Тишью бумага, дизайнерская бумага 30г/м², размер A4, печать 4+4, тираж 2000шт'),
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'history',
      title: 'История',
      description: 'Посмотреть историю',
      icon: <History className="w-5 h-5" />,
      action: onShowHistory,
      color: 'from-gray-500 to-gray-600'
    },
    {
      id: 'stats',
      title: 'Статистика',
      description: 'Показать статистику',
      icon: <Settings className="w-5 h-5" />,
      action: onShowStats,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 md:p-6 animate-in slide-in-from-bottom duration-500">
      <h3 className="text-white font-medium mb-4 text-sm md:text-base">Быстрые действия</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {quickActions.map((action, index) => (
          <button
            key={action.id}
            onClick={action.action}
            className={`bg-gradient-to-r ${action.color} hover:scale-105 active:scale-95 text-white rounded-lg p-3 md:p-4 shadow-lg transition-all duration-200 animate-in scale-in duration-300`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className="bg-white/20 rounded-full p-2">
                {action.icon}
              </div>
              <div className="text-center">
                <p className="font-medium text-xs md:text-sm">{action.title}</p>
                <p className="text-white/80 text-xs hidden md:block">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
