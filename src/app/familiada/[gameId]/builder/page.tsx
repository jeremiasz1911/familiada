// src/app/familiada/[gameId]/builder/page.tsx
"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { TeamsEditor } from "@/components/familiada/TeamsEditor";
import { QuestionsEditor } from "@/components/familiada/QuestionsEditor";
import { RoundsEditor } from "@/components/familiada/RoundsEditor";
import { FinalPlayersEditor } from "@/components/familiada/FinalPlayersEditor";
import { FinalQuestionsEditor } from "@/components/familiada/FinalQuestionsEditor";

function copy(text: string) {
  navigator.clipboard.writeText(text);
}

export default function BuilderPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const tv = `${origin}/familiada/${gameId}/screen`;
  const play = `${origin}/familiada/${gameId}/play`;
  const setup = `${origin}/familiada/${gameId}/setup`;

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto">
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl md:text-2xl">Builder</CardTitle>
            <div className="text-xs opacity-70 mt-1">GameId: {gameId}</div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.open(tv, "_blank")}>
              TV
            </Button>
            <Button variant="secondary" onClick={() => window.open(play, "_blank")}>
              Prowadzący
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="questions" className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="rounds">Rundy</TabsTrigger>
              <TabsTrigger value="questions">Pytania</TabsTrigger>
              <TabsTrigger value="teams">Drużyny</TabsTrigger>
              <TabsTrigger value="final">Finał</TabsTrigger>
              <TabsTrigger value="links">Linki</TabsTrigger>
            </TabsList>

            <TabsContent value="rounds" className="mt-4">
              <RoundsEditor gameId={gameId} />
            </TabsContent>

            <TabsContent value="questions" className="mt-4">
              <QuestionsEditor gameId={gameId} />
            </TabsContent>

            <TabsContent value="teams" className="mt-4">
              <TeamsEditor gameId={gameId} />
            </TabsContent>

            <TabsContent value="final" className="mt-4">
              <div className="grid gap-4">
                <FinalQuestionsEditor gameId={gameId} />
                <FinalPlayersEditor gameId={gameId} />
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-4">
              <Card className="bg-black/10 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base">Linki do gry</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="text-sm">
                    <div className="opacity-70">TV</div>
                    <div className="break-all">{tv}</div>
                    <Button className="mt-2" variant="secondary" onClick={() => copy(tv)}>
                      Kopiuj TV
                    </Button>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="text-sm">
                    <div className="opacity-70">Prowadzący</div>
                    <div className="break-all">{play}</div>
                    <Button className="mt-2" variant="secondary" onClick={() => copy(play)}>
                      Kopiuj prowadzącego
                    </Button>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="text-sm">
                    <div className="opacity-70">Setup</div>
                    <div className="break-all">{setup}</div>
                    <Button className="mt-2" variant="secondary" onClick={() => copy(setup)}>
                      Kopiuj setup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}