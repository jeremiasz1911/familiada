"use client";

import { useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { FinalPlayersEditor } from "@/components/familiada/FinalPlayersEditor";
import { FinalQuestionsEditor } from "@/components/familiada/FinalQuestionsEditor";

export default function FinalBuilderPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto">
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Finał – Builder</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.open(`/familiada/${gameId}/final/play`, "_blank")}>
              Prowadzący
            </Button>
            <Button variant="secondary" onClick={() => window.open(`/familiada/${gameId}/final/screen`, "_blank")}>
              TV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="questions">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="questions">Pytania</TabsTrigger>
              <TabsTrigger value="players">Zawodnicy</TabsTrigger>
            </TabsList>

            <TabsContent value="questions" className="mt-4">
              <FinalQuestionsEditor gameId={gameId} />
            </TabsContent>

            <TabsContent value="players" className="mt-4">
              <FinalPlayersEditor gameId={gameId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}