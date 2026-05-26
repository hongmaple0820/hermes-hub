'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Emoji Data
// ---------------------------------------------------------------------------
interface EmojiCategory {
  key: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'emojiSmileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫',
      '🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳',
      '🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯',
      '😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢',
      '😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤',
      '😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹',
    ],
  },
  {
    key: 'emojiGestures',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
      '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅',
      '🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠',
      '🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋',
    ],
  },
  {
    key: 'emojiHearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
      '💟','♥️','🫶','🫀','💒','💑','💏','👩‍❤️‍👨','👩‍❤️‍👩','👨‍❤️‍👨',
    ],
  },
  {
    key: 'emojiAnimals',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
      '🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒',
      '🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇',
      '🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞',
      '🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍',
      '🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠',
      '🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍',
    ],
  },
  {
    key: 'emojiFood',
    emojis: [
      '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈',
      '🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦',
      '🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔',
      '🍠','🫘','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳',
      '🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟',
      '🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘',
      '🫕','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤',
    ],
  },
  {
    key: 'emojiTravel',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
      '🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼',
      '🚁','🛸','✈️','🛩️','🚀','🛶','⛵','🚤','🛥️','🛳️',
      '⛰️','🏔️','🌋','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️',
      '🧱','🪨','🪵','🛖','🏘️','🏚️','🏠','🏡','🏢','🏣',
      '🏰','💒','🏙️','🗼','🗽','⛪','🕌','🛕','🕍','⛩️',
    ],
  },
  {
    key: 'emojiObjects',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️',
      '💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️',
      '📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭',
      '⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌',
      '💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶',
      '💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧',
      '🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧲','🔫',
    ],
  },
];

// Keyword map for emoji search
const EMOJI_KEYWORDS: Record<string, string[]> = {
  '😀': ['grin', 'smile', 'happy', 'laugh'],
  '😃': ['smile', 'happy', 'joy'],
  '😄': ['smile', 'happy', 'joy'],
  '😁': ['grin', 'happy', 'smile'],
  '😆': ['laugh', 'happy'],
  '😅': ['sweat', 'nervous', 'laugh'],
  '🤣': ['rofl', 'laugh', 'rolling'],
  '😂': ['joy', 'tears', 'laugh', 'cry'],
  '🙂': ['smile', 'slight'],
  '🙃': ['upside', 'flip'],
  '😉': ['wink', 'flirt'],
  '😊': ['blush', 'shy', 'smile'],
  '😇': ['angel', 'innocent', 'halo'],
  '🥰': ['love', 'hearts', 'adorable'],
  '😍': ['heart', 'eyes', 'love'],
  '🤩': ['star', 'excited', 'wow'],
  '😘': ['kiss', 'love'],
  '😗': ['kiss'],
  '😚': ['kiss', 'blush'],
  '😙': ['kiss', 'smile'],
  '😋': ['yummy', 'delicious', 'tongue'],
  '😛': ['tongue', 'playful'],
  '😜': ['wink', 'tongue', 'crazy'],
  '🤪': ['crazy', 'zany', 'wild'],
  '😝': ['tongue', 'squint'],
  '🤑': ['money', 'rich'],
  '🤗': ['hug', 'embrace'],
  '🤭': ['giggle', 'cover', 'shy'],
  '🤫': ['shush', 'quiet', 'secret'],
  '🤔': ['think', 'wonder', 'hmm'],
  '🤐': ['zip', 'mute', 'quiet'],
  '🤨': ['skeptical', 'raised', 'eyebrow'],
  '😐': ['neutral', 'meh'],
  '😑': ['expressionless', 'blank'],
  '😶': ['silent', 'speechless'],
  '😏': ['smirk', 'sly'],
  '😒': ['unamused', 'bored'],
  '🙄': ['eye', 'roll', 'annoyed'],
  '😬': ['grimace', 'awkward'],
  '😌': ['relieved', 'peaceful'],
  '😔': ['sad', 'pensive', 'down'],
  '😪': ['sleepy', 'tired'],
  '😴': ['sleep', 'zzz'],
  '😷': ['mask', 'sick', 'covid'],
  '🤒': ['thermometer', 'sick', 'fever'],
  '🤕': ['bandage', 'hurt', 'injured'],
  '🤢': ['nauseous', 'sick', 'gross'],
  '🤮': ['vomit', 'sick', 'gross'],
  '🥵': ['hot', 'heat', 'sweat'],
  '🥶': ['cold', 'freeze', 'ice'],
  '🥴': ['drunk', 'dizzy', 'woozy'],
  '😵': ['dizzy', 'dead'],
  '🤯': ['mind', 'blown', 'exploding'],
  '🤠': ['cowboy', 'western'],
  '🥳': ['party', 'celebrate', 'birthday'],
  '😎': ['cool', 'sunglasses'],
  '🤓': ['nerd', 'glasses', 'smart'],
  '🧐': ['monocle', 'inspect', 'curious'],
  '😕': ['confused'],
  '😟': ['worried'],
  '🙁': ['frown', 'sad'],
  '😮': ['surprise', 'oh'],
  '😯': ['hushed', 'surprised'],
  '😲': ['astonished', 'shocked'],
  '😳': ['flushed', 'embarrassed'],
  '🥺': ['plead', 'please', 'beg'],
  '🥹': ['hold', 'tears', 'emotional'],
  '😨': ['fearful', 'scared'],
  '😰': ['anxious', 'nervous', 'sweat'],
  '😥': ['sad', 'relieved', 'disappointed'],
  '😢': ['cry', 'sad', 'tear'],
  '😭': ['sob', 'cry', 'wail'],
  '😱': ['scream', 'horror', 'scared'],
  '😖': ['confounded', 'struggle'],
  '😣': ['persevere', 'stress'],
  '😞': ['disappointed'],
  '😓': ['sweat', 'stress'],
  '😩': ['weary', 'tired', 'exhausted'],
  '😫': ['tired', 'exhausted'],
  '🥱': ['yawn', 'bored', 'tired'],
  '😤': ['angry', 'huff', 'triumph'],
  '😡': ['angry', 'rage', 'mad'],
  '😠': ['angry', 'mad'],
  '🤬': ['curse', 'swear', 'angry'],
  '😈': ['devil', 'evil', 'mischievous'],
  '👿': ['devil', 'angry', 'evil'],
  '💀': ['skull', 'dead', 'death'],
  '☠️': ['skull', 'crossbones', 'danger'],
  '💩': ['poop', 'crap'],
  '🤡': ['clown'],
  '👹': ['ogre', 'monster', 'demon'],
  '👋': ['wave', 'hello', 'bye', 'hi'],
  '🤚': ['raised', 'back', 'hand', 'stop'],
  '🖐️': ['hand', 'five', 'spread'],
  '✋': ['hand', 'raise', 'stop', 'high'],
  '👌': ['ok', 'perfect', 'fine'],
  '🤌': ['pinch', 'italian'],
  '🤏': ['pinching', 'small', 'tiny'],
  '✌️': ['peace', 'victory', 'two'],
  '🤞': ['crossed', 'fingers', 'luck', 'hope'],
  '🤟': ['love', 'rock'],
  '🤘': ['rock', 'metal'],
  '🤙': ['call', 'shaka', 'hang'],
  '👈': ['point', 'left', 'this'],
  '👉': ['point', 'right', 'that'],
  '👆': ['point', 'up', 'here'],
  '👇': ['point', 'down', 'below'],
  '👍': ['thumbs', 'up', 'like', 'good', 'approve', 'yes'],
  '👎': ['thumbs', 'down', 'dislike', 'bad', 'no'],
  '✊': ['fist', 'power', 'solidarity'],
  '👊': ['punch', 'fist', 'bump'],
  '👏': ['clap', 'applause', 'bravo'],
  '🙌': ['raise', 'hands', 'celebrate', 'praise'],
  '🫶': ['heart', 'hands', 'love'],
  '👐': ['open', 'hands'],
  '🤲': ['palms', 'together', 'receive'],
  '🤝': ['handshake', 'deal', 'agreement'],
  '🙏': ['pray', 'please', 'thanks', 'namaste'],
  '💪': ['muscle', 'strong', 'power', 'flex'],
  '👀': ['eyes', 'look', 'see', 'watch'],
  '❤️': ['red', 'heart', 'love'],
  '🧡': ['orange', 'heart', 'love'],
  '💛': ['yellow', 'heart', 'love'],
  '💚': ['green', 'heart', 'love'],
  '💙': ['blue', 'heart', 'love'],
  '💜': ['purple', 'heart', 'love'],
  '🖤': ['black', 'heart', 'love'],
  '🤍': ['white', 'heart', 'love'],
  '💔': ['broken', 'heart', 'sad'],
  '❤️‍🔥': ['fire', 'heart', 'passion'],
  '💕': ['two', 'hearts', 'love'],
  '💞': ['revolving', 'hearts'],
  '💓': ['beating', 'heart'],
  '💗': ['growing', 'heart'],
  '💖': ['sparkling', 'heart'],
  '💘': ['cupid', 'heart', 'arrow'],
  '💝': ['gift', 'heart', 'ribbon'],
  '🐶': ['dog', 'puppy', 'pet'],
  '🐱': ['cat', 'kitten', 'pet'],
  '🐭': ['mouse', 'rat'],
  '🐹': ['hamster'],
  '🐰': ['rabbit', 'bunny', 'easter'],
  '🦊': ['fox'],
  '🐻': ['bear'],
  '🐼': ['panda'],
  '🐨': ['koala'],
  '🐯': ['tiger'],
  '🦁': ['lion'],
  '🐮': ['cow'],
  '🐷': ['pig'],
  '🐸': ['frog'],
  '🐵': ['monkey'],
  '🐔': ['chicken'],
  '🐧': ['penguin'],
  '🐦': ['bird'],
  '🦋': ['butterfly'],
  '🐙': ['octopus'],
  '🐠': ['fish', 'tropical'],
  '🐟': ['fish'],
  '🐬': ['dolphin'],
  '🐳': ['whale'],
  '🍎': ['apple', 'fruit', 'red'],
  '🍊': ['orange', 'fruit'],
  '🍋': ['lemon', 'fruit', 'sour'],
  '🍌': ['banana', 'fruit'],
  '🍉': ['watermelon', 'fruit'],
  '🍇': ['grape', 'fruit', 'wine'],
  '🍓': ['strawberry', 'fruit', 'berry'],
  '🍑': ['peach', 'fruit'],
  '🍍': ['pineapple', 'fruit'],
  '🍞': ['bread', 'loaf'],
  '🧀': ['cheese'],
  '🍳': ['egg', 'frying', 'breakfast'],
  '🍔': ['burger', 'hamburger'],
  '🍟': ['fries', 'french', 'chips'],
  '🍕': ['pizza'],
  '🌮': ['taco', 'mexican'],
  '🍣': ['sushi', 'japanese'],
  '🍜': ['noodle', 'ramen', 'soup'],
  '🚗': ['car', 'automobile', 'red'],
  '🚕': ['taxi', 'cab'],
  '🚌': ['bus'],
  '🏎️': ['race', 'car', 'fast'],
  '🚑': ['ambulance', 'emergency'],
  '🚒': ['fire', 'truck', 'engine'],
  '🏍️': ['motorcycle', 'bike'],
  '🚲': ['bicycle', 'bike'],
  '✈️': ['airplane', 'plane', 'fly', 'travel'],
  '🚀': ['rocket', 'launch', 'space'],
  '⛵': ['sailboat', 'sail', 'boat'],
  '🏠': ['house', 'home'],
  '🏡': ['house', 'garden', 'home'],
  '🏢': ['office', 'building'],
  '🏰': ['castle'],
  '🗼': ['tower', 'tokyo', 'eiffel'],
  '🗽': ['statue', 'liberty', 'newyork'],
  '📱': ['phone', 'mobile', 'iphone'],
  '💻': ['laptop', 'computer', 'mac', 'pc'],
  '⌨️': ['keyboard', 'type'],
  '🖥️': ['desktop', 'computer', 'monitor'],
  '💾': ['floppy', 'disk', 'save'],
  '📷': ['camera', 'photo'],
  '📞': ['phone', 'call', 'telephone'],
  '📺': ['tv', 'television'],
  '⏰': ['alarm', 'clock', 'time'],
  '💡': ['light', 'bulb', 'idea'],
  '💰': ['money', 'bag', 'rich'],
  '💎': ['gem', 'diamond', 'jewel'],
  '🔧': ['wrench', 'tool', 'fix'],
  '🔑': ['key', 'lock'],
  '🔨': ['hammer', 'tool', 'build'],
};

// ---------------------------------------------------------------------------
// EmojiPicker Component
// ---------------------------------------------------------------------------
interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function EmojiPicker({ open, onClose, onEmojiSelect, anchorRef }: EmojiPickerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        // Also check if the click is on the trigger button
        if (anchorRef?.current && anchorRef.current.contains(target)) return;
        onClose();
      }
    }

    // Use a small delay to avoid immediately closing from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Filter emojis by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const q = search.toLowerCase().trim();

    // Search through all emojis using keyword mapping
    const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    const filteredEmojis = allEmojis.filter((emoji) => {
      const keywords = EMOJI_KEYWORDS[emoji];
      if (!keywords) return false;
      return keywords.some((kw) => kw.includes(q) || q.includes(kw));
    });

    return [{ key: 'emojiSmileys', emojis: filteredEmojis }];
  }, [search]);

  // Scroll to category
  const scrollToCategory = useCallback((index: number) => {
    setActiveCategory(index);
    const el = categoryRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Handle emoji click
  const handleEmojiClick = useCallback((emoji: string) => {
    onEmojiSelect(emoji);
  }, [onEmojiSelect]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={pickerRef}
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute bottom-full right-0 mb-2 w-80 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {/* Header with search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={t('chat.searchEmoji')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
                autoFocus
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex border-b border-border overflow-x-auto scrollbar-none">
            {(search.trim() ? EMOJI_CATEGORIES : EMOJI_CATEGORIES).map((category, i) => (
              <button
                key={category.key}
                onClick={() => scrollToCategory(i)}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition-colors shrink-0',
                  activeCategory === i
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`chat.${category.key}`)}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <ScrollArea className="h-64">
            <div className="p-2">
              {filteredCategories.map((category, catIndex) => (
                <div
                  key={category.key}
                  ref={(el) => { categoryRefs.current[catIndex] = el; }}
                  className="mb-2"
                >
                  {!search.trim() && (
                    <p className="text-[10px] font-medium text-muted-foreground px-1 py-1 uppercase tracking-wider">
                      {t(`chat.${category.key}`)}
                    </p>
                  )}
                  <div className="grid grid-cols-8 gap-0.5">
                    {category.emojis.map((emoji, i) => (
                      <button
                        key={`${emoji}-${i}`}
                        onClick={() => handleEmojiClick(emoji)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-lg transition-colors cursor-pointer"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
