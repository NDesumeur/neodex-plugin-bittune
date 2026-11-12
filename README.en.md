# BitTune

Compose chiptune music, with the 5 voices of old 8-bit consoles, per-note effects, and export to WAV or MIDI.

*Version française : [README.md](README.md)*

![BitTune](screenshots/1.jpg)

## Voices

- **Square 1** and **Square 2**: melody and accompaniment. Three wave shapes: 12.5 %, 25 % or 50 % duty cycle (from nasal to round).
- **Triangle**: the bass, one octave lower.
- **Noise**: 6 drums (kick, snare, hi-hat, cymbal, open hi-hat, tom), from a shift-register noise like the NES one.
- **Sawtooth**: a brighter voice, for solos and pads.

Each voice has its own **volume**, **pan** (left or right), **echo**, **octave** (−2 to +2), and the **M** (mute) and **S** (solo) buttons. The other voices' notes stay visible, faded.

## Composing

- The grid is 32 steps (8 beats) over three octaves, from C3 to C6, with the keyboard on the left.
- **Click** to place a note (you hear it), **drag right** to hold it, **right click** to erase it.
- **Per-note effects**: pick a tool then click a note. **Vib** (vibrato), **Maj** and **Min** (major and minor arpeggios, the console way), **↗** (slides in), **↘** (drops two octaves, laser effect), **Piqué** (very short note), **Vol** (4 volume levels, each click lowers it one step).
- **Scale**: pick the root and the scale (major, minor, pentatonic, minor pentatonic, blues); notes outside the scale are darkened, and **Coller à la gamme** (snap to scale) stops you placing them.
- 8 patterns, **A** to **H**, and a free **order** (for example `AABACDGH`, 64 at most). **Copy**, **Paste**, **Clear** a pattern, **transpose** a voice by a semitone or an octave.
- **Tempo** from 60 to 240 bpm, **swing** from 0 to 50 %. **⟳** plays the whole song or only the shown pattern, looping. An oscilloscope shows the wave while playing.
- **Space**: play or pause · **Ctrl+Z / Ctrl+Y**: undo / redo.
- **Examples**: three ready-made songs (Départ, Aventure, Donjon) to see how they are built.

## Export

- **Export WAV** renders the whole song in 44.1 kHz stereo, effects and echo included.
- **Export MIDI** gives a file for your music software: one MIDI channel per voice, the drums on channel 10.
- **Save the song** and **Open a song**: a `.bittune.json` file to keep or share it.

## Data

The patterns, the order, the tempo and the voice settings are kept in the plugin folder. Permission: `storage` only.
