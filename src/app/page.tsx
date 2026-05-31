'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef }                    from 'react';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { NeuralStream }             from '@/components/NeuralStream';
import { LiquidTimeline }           from '@/components/LiquidTimeline';
import { DragOverlayEntity }        from '@/components/DraggableEntity';
import { LocaleToggle }             from '@/components/LocaleToggle';
import { NeuralOnboarding }         from '@/components/NeuralOnboarding';
import { AnticipatoryToastStack }   from '@/components/AnticipatoryToast';
import { HubNavigator }             from '@/components/HubNavigator';
import { PlanningBoard }            from '@/components/PlanningBoard';
import { LiveCursors }              from '@/components/LiveCursors';
import { useTravelEngine }          from '@/store/useTravelEngine';
import { useNavigationStore }       from '@/store/useNavigationStore';
import { CrisisManager }            from '@/services/CrisisManager';
import { useToastStore }            from '@/store/useToastStore';
import { handleMasterEntityDrop }   from '@/utils/DropCascade';
import { AggregatedResult }         from '@/services/OmniAggregator';

const MexicoTerrain = dynamic(
  () => import('@/components/background/MexicoTerrain').then(m => ({ default: m.MexicoTerrain })),
  { ssr: false }
);

function UnitravelApp() {
  const { setDragging, dragging, onboardingComplete } = useTravelEngine();
  const { openHub } = useNavigationStore();
  const managerRef  = useRef<CrisisManager | null>(null);

  useEffect(() => {
    if (!onboardingComplete) return;

    const manager = new CrisisManager(
      () => useTravelEngine.getState().days,
      (event, mutations) => {
        useTravelEngine.getState().applyMutations(mutations, event);
        useToastStore.getState().addToast(event);
      },
    );
    managerRef.current = manager;
    manager.start(55_000);

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') manager.simulateCrisis();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      manager.stop();
      window.removeEventListener('keydown', onKey);
    };
  }, [onboardingComplete]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const { source } = e.active.data.current as { source: AggregatedResult };
    if (source) setDragging(source);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { over, active } = e;
    if (!over) return;
    const { source } = active.data.current as { source: AggregatedResult };
    if (!source) return;

    handleMasterEntityDrop(source, over.id as string).catch(console.error);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <LayoutGroup>
        <main className="relative flex h-screen w-screen overflow-hidden">
          <MexicoTerrain />

          <AnimatePresence>
            {onboardingComplete && (
              <motion.div
                key="app-content"
                className="contents"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="fixed top-4 z-50" style={{ insetInlineEnd: 80 }}>
                  <LocaleToggle />
                </div>
                {/* Search button — floating top-start */}
                <motion.button
                  className="fixed top-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black"
                  style={{
                    insetInlineStart: 20,
                    background:       'rgba(0,122,255,0.90)',
                    backdropFilter:   'blur(20px)',
                    boxShadow:        '0 4px 16px rgba(0,122,255,0.35)',
                    color:            '#ffffff',
                  }}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.4 }}
                  whileHover={{ scale: 1.04, boxShadow: '0 6px 24px rgba(0,122,255,0.45)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openHub}
                >
                  <span>✦</span>
                  <span>Search</span>
                </motion.button>
                <NeuralStream />
                <LiquidTimeline />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </LayoutGroup>

      <AnimatePresence>
        {!onboardingComplete && <NeuralOnboarding />}
      </AnimatePresence>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
        {dragging && 'sourceCount' in dragging && (
          <DragOverlayEntity entity={dragging as AggregatedResult} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default function Home() {
  return (
    <>
      <UnitravelApp />
      <AnticipatoryToastStack />
      <HubNavigator />
      <AnimatePresence>
        <PlanningBoard />
      </AnimatePresence>
      <LiveCursors />
    </>
  );
}
