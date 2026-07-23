import { Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Construction className="h-5 w-5 text-primary" />
            Coming soon
          </CardTitle>
          <CardDescription>
            This module is part of a later delivery phase. The data model and API surface are already
            defined in the Prisma schema and shared package.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
