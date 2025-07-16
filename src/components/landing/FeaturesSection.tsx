import { Card, CardContent } from "@/components/ui/card";
import { Upload, MessageCircle, FileText, BookmarkPlus } from "lucide-react";

export const FeaturesSection = () => {
  const features = [
    {
      icon: Upload,
      title: "PDF Upload & Analysis",
      description: "Drag and drop your offering memorandums and get instant analysis with key metrics extracted automatically.",
      highlight: "99% accuracy"
    },
    {
      icon: MessageCircle,
      title: "AI-Powered Chat",
      description: "Ask natural language questions about your deals. Get detailed insights on cap rates, NOI, cash flow, and more.",
      highlight: "Smart Q&A"
    },
    {
      icon: FileText,
      title: "Deal Snapshot Summary",
      description: "Get comprehensive summaries with property details, financial metrics, and investment highlights in seconds.",
      highlight: "Instant summaries"
    },
    {
      icon: BookmarkPlus,
      title: "Save & Resume Conversations",
      description: "Never lose your analysis. Save conversations and continue your due diligence process across multiple sessions.",
      highlight: "Seamless workflow"
    }
  ];

  return (
    <section className="py-24 px-4 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Everything You Need for{" "}
            <span className="text-gradient">CRE Analysis</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our AI-powered platform streamlines your commercial real estate analysis workflow with intelligent document processing and conversational insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="card-gradient shadow-soft hover:shadow-medium transition-all duration-300 hover:-translate-y-2 border-0"
            >
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                
                <div className="mb-4">
                  <div className="inline-block bg-accent/20 text-accent-foreground px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    {feature.highlight}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {feature.title}
                  </h3>
                </div>
                
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-8 bg-card shadow-soft rounded-2xl p-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">10x</div>
              <div className="text-sm text-muted-foreground">Faster Analysis</div>
            </div>
            <div className="w-px h-12 bg-border"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">99%</div>
              <div className="text-sm text-muted-foreground">Accuracy Rate</div>
            </div>
            <div className="w-px h-12 bg-border"></div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">50+</div>
              <div className="text-sm text-muted-foreground">Data Points</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};