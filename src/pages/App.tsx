import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, MessageSquare, BarChart3, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const App = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <h1 className="text-xl font-semibold text-foreground">OM Intel Chat</h1>
            <div className="w-20"></div> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Upload Your First Deal
          </h1>
          <p className="text-xl text-muted-foreground">
            Get started by uploading an offering memorandum and let our AI analyze it for you
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center p-6 hover:shadow-medium transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">1. Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Drag and drop your PDF offering memorandum
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-medium transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">2. AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Our AI extracts key metrics and financial data
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-medium transition-all">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">3. Chat & Analyze</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Ask questions and get detailed insights
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="p-8 card-gradient shadow-soft">
          <div className="text-center">
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-12 hover:border-primary/50 transition-colors cursor-pointer group">
              <Upload className="w-16 h-16 text-primary/70 mx-auto mb-4 group-hover:text-primary transition-colors" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Drop your PDF here
              </h3>
              <p className="text-muted-foreground mb-4">
                Or click to browse and select your offering memorandum
              </p>
              <Button className="bg-primary hover:bg-primary-light text-primary-foreground">
                Choose File
              </Button>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Supported formats: PDF • Max file size: 50MB • Your data is secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;