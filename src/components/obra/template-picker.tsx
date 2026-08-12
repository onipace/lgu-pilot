'use client';

import { FileText, Shield, Wallet, ScrollText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { OrdTemplateType } from '@/types';

interface TemplatePickerProps {
  onSelect: (template: OrdTemplateType) => void;
  selected: OrdTemplateType | null;
}

const templates: { value: OrdTemplateType; label: string; description: string; icon: typeof FileText }[] = [
  { value: 'tax', label: 'Tax Ordinance', description: 'Local tax regulations, fee schedules, and revenue measures', icon: FileText },
  { value: 'regulatory', label: 'Regulatory Ordinance', description: 'Rules governing activities, establishments, and public conduct', icon: Shield },
  { value: 'appropriation', label: 'Appropriation Ordinance', description: 'Municipal budget allocations and fund appropriations', icon: Wallet },
  { value: 'general', label: 'General Ordinance', description: 'General welfare measures, policies, and municipal regulations', icon: ScrollText },
];

export default function TemplatePicker({ onSelect, selected }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {templates.map((template) => {
        const Icon = template.icon;
        const isSelected = selected === template.value;
        return (
          <Card
            key={template.value}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(template.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(template.value); } }}
            className={cn(
              'cursor-pointer border-2 transition-all hover:shadow-md bg-[hsl(224_35%_17%)]',
              isSelected ? 'border-[hsl(158_64%_45%)] ring-2 ring-[hsl(158_64%_45%/0.25)]' : 'border-transparent hover:border-[hsl(224_27%_30%)]'
            )}
          >
            <CardContent className="flex items-start gap-4 pt-2">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', isSelected ? 'bg-[hsl(158_64%_45%/0.25)]' : 'bg-[hsl(158_64%_45%/0.1)]')}>
                <Icon className={cn('h-6 w-6', isSelected ? 'text-[hsl(158_64%_60%)]' : 'text-[hsl(158_64%_50%)]')} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[hsl(214_100%_97%)]">{template.label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[hsl(216_20%_55%)]">{template.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
