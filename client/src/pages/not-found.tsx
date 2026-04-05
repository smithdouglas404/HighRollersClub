import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 bg-surface-lowest border-white/[0.06]">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <h1 className="text-2xl font-bold text-white">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            Did you forget to add the page to the router?
          </p>

          <Link href="/">
            <a className="inline-block mt-4 px-4 py-2 rounded-lg bg-primary/20 text-primary font-bold text-sm border border-primary/30 hover:bg-primary/30 transition-all">
              Go Home
            </a>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
