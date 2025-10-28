import React from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Tag, List } from 'lucide-react';
import { clsx } from 'clsx';

interface DraftCaseCardProps {
  id: string;
  name: string;
  description?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  qualityScore?: number;
  batchNumber: number;
  stepsCount?: number;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

const priorityMap = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低'
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3 }
  }
};

export function DraftCaseCard({
  id,
  name,
  description,
  priority,
  qualityScore = 85,
  batchNumber,
  stepsCount = 0,
  selected,
  onToggleSelect
}: DraftCaseCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      layout
      className={clsx(
        "relative bg-white rounded-xl p-5 border-2 transition-all duration-200",
        "cursor-pointer hover:shadow-lg",
        selected
          ? "border-purple-500 shadow-lg ring-4 ring-purple-500/20"
          : "border-gray-200 hover:border-purple-300"
      )}
      onClick={() => onToggleSelect(id)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* 选中指示器 */}
      <div className="absolute top-3 right-3">
        <motion.div
          className={clsx(
            "w-7 h-7 rounded-full flex items-center justify-center transition-all",
            selected
              ? "bg-gradient-to-br from-purple-500 to-blue-500"
              : "bg-gray-200"
          )}
          whileTap={{ scale: 0.9 }}
        >
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Check className="w-4 h-4 text-white" />
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* 批次标记 */}
      <span className="absolute top-3 left-3 px-2.5 py-1 bg-blue-100 text-blue-700
                       text-xs font-medium rounded-full">
        批次 {batchNumber}
      </span>

      {/* 用例内容 */}
      <div className="mt-8">
        <h4 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2
                       min-h-[3rem]">
          {name}
        </h4>

        <p className="text-sm text-gray-500 mb-4 line-clamp-3 min-h-[4rem]">
          {description || '暂无描述'}
        </p>

        {/* 元数据 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          {/* 优先级 */}
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className={clsx(
              "text-xs font-medium",
              priority === 'critical' && "text-red-600",
              priority === 'high' && "text-orange-600",
              priority === 'medium' && "text-blue-600",
              priority === 'low' && "text-gray-600"
            )}>
              {priorityMap[priority]}
            </span>
          </div>

          {/* 步骤数 */}
          {stepsCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <List className="w-4 h-4" />
              <span>{stepsCount} 步</span>
            </div>
          )}

          {/* 质量评分 */}
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-semibold text-gray-700">
              {qualityScore}/100
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
