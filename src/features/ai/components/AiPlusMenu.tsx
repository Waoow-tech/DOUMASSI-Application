// Menu « + » du chat IA — E5-10.
//
// Le bouton ⊕ de la barre de saisie (cf. maquette Canva « Studio AI ») ouvre ce
// menu d'actions. PARTI PRIS (validé CTO) : on n'y met QUE ce qui est livré.
// Les autres entrées du Canva (photos, image, réflexion, web search, tools,
// more) s'ajouteront ici au fur et à mesure qu'elles seront construites — pas
// de « bientôt » cliquable dans un menu.
//
// Aujourd'hui : Historique (E5-04) + Learning (E5-08).

import { Check, Globe, GraduationCap, History, ImagePlus, Wrench } from 'lucide-react-native';
import { Sheet, Text, XStack } from 'tamagui';

import { useTranslations } from '@/i18n';

const ACCENT = '#FFFFFF';

export interface AiPlusMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mode Learning actif ? (affiche une coche sur la ligne) */
  learningActive: boolean;
  onOpenHistory: () => void;
  onToggleLearning: () => void;
  onAddPhoto: () => void;
  onOpenTools: () => void;
  onOpenWebSearch: () => void;
}

export function AiPlusMenu({
  open,
  onOpenChange,
  learningActive,
  onOpenHistory,
  onToggleLearning,
  onAddPhoto,
  onOpenTools,
  onOpenWebSearch,
}: AiPlusMenuProps) {
  const t = useTranslations();

  const close = () => onOpenChange(false);

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[56]} dismissOnSnapToBottom>
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.55)"
      />
      <Sheet.Handle />
      <Sheet.Frame
        backgroundColor="$background"
        borderTopLeftRadius={20}
        borderTopRightRadius={20}
        padding={12}
        gap={2}
      >
        <Text
          fontSize={12}
          fontWeight="700"
          color="$textSecondary"
          textTransform="uppercase"
          paddingHorizontal={12}
          paddingVertical={8}
        >
          {t.ai.menu.title}
        </Text>

        {/* Ajouter une photo (E5-06) */}
        <MenuRow
          icon={<ImagePlus size={20} color="#FFFFFF" />}
          label={t.ai.menu.addPhoto}
          onPress={() => {
            close();
            onAddPhoto();
          }}
        />

        {/* Historique (E5-04) */}
        <MenuRow
          icon={<History size={20} color="#FFFFFF" />}
          label={t.ai.menu.history}
          onPress={() => {
            close();
            onOpenHistory();
          }}
        />

        {/* Learning (E5-08) — bascule, avec coche si actif */}
        <MenuRow
          icon={<GraduationCap size={20} color={learningActive ? ACCENT : '#FFFFFF'} />}
          label={t.ai.menu.learning}
          active={learningActive}
          trailing={learningActive ? <Check size={18} color={ACCENT} /> : null}
          onPress={() => {
            close();
            onToggleLearning();
          }}
        />

        {/* Outils : calculatrice + traducteur (E5-18) */}
        <MenuRow
          icon={<Wrench size={20} color="#FFFFFF" />}
          label={t.ai.menu.tools}
          onPress={() => {
            close();
            onOpenTools();
          }}
        />

        {/* Recherche web via Tavily (E5-17) */}
        <MenuRow
          icon={<Globe size={20} color="#FFFFFF" />}
          label={t.ai.menu.webSearch}
          onPress={() => {
            close();
            onOpenWebSearch();
          }}
        />
      </Sheet.Frame>
    </Sheet>
  );
}

function MenuRow({
  icon,
  label,
  active = false,
  trailing = null,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <XStack
      alignItems="center"
      gap={14}
      paddingHorizontal={12}
      paddingVertical={14}
      borderRadius={12}
      onPress={onPress}
      pressStyle={{ opacity: 0.65, backgroundColor: '$surface' }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text flex={1} fontSize={15} fontWeight="600" color={active ? ACCENT : '$color'}>
        {label}
      </Text>
      {trailing}
    </XStack>
  );
}
