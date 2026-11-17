# Muginator

## Description

Muginator is a web app for iOS that serves as a simple helper for brewing pourover coffee from beans to mug.

It logs the details of your brews
- Bean variety
- Roaster
- Roast level
- Amount of beans in grams
- Beans to water ratio
- Grinder model
- Grind coarsness
- Filter model
- Paper
- Water temperature
- Amount of water in grams
- Pour steps: bloom, number and duration of pours, drawdown and total brewtime
- Tasting notes

## User Interface

User can move back and forth between the steps below until they start the brew timer by tapping "Start Bloom" in Pour steps. 

### Beans

User enters bean variety by typing. Previously entered varieties are remembered and suggested based on the entry.

Roaster name is entered in a same way than bean variety.

Roast level is a five step selector. Each step is a coffee bean, five in total, each bean is divided into half and full selection. Leftmost bean is the lightest, rightmost the darkest signifying the roast level.

Amount of beans is given in whole grams. Input from number pad.

User enters the desired beans to water ratio, for example 16:1, which then calculates the amount of water needed.

### Grinder

User enters the grinder model by typing. Previously entered models are remembered and suggested based on the entry.

Grind coarsness is selected from a wheel that imitates 1Zpresso K-Ultra's selection wheel. Coarsness can be set from 0 to 9.9 in increments of 0.1. The wheel can loop around from 9.9 back to 0.

### Filter model and paper

User enters the filter model by typing. Previously entered models are remembered and suggested based on the entry.

User enters the filter paper model by typing. Previously entered models are remembered and suggested based on the entry.

### Water

User enters the water temperature in whole degrees in Celsius. This is optional and can be left unentered. The temperature readin is then marked as -

Amount of water is calculated from the amount of beans and beans to water ratio.

After all information is entered there is a "Start Brewing" button which goes into the pour steps phase.

### Pour steps

This is a timer interface which will start the actual brewing process.

User initiates the process by tapping a "Start Bloom" button which starts the bloom phase and a timer appears and starts running. The phase of the brewing process is also visible.

Phases:
1. Start Bloom: tapping this begins the bloom phase and starts a timer from 00:00 (minutes:seconds). The timer is a prominent visual element. The heading says "Bloom". After tapping "Start Bloom" the text on the button changes to "Pour 1". The user taps this button when the bloom is over. Length of the bloom is shown and recorded. The timer keeps running.
2. Pour 1: The timer is still running, showing total brew time. The heading changes to "Pour 1". At the start of "Pour 1" phase a new button appears that says "Finished". The text on "Pour 1" button changes to "Pour 2". User taps this when pour 1 is finished. Length of pour 1 is shown and recorded. The timer keeps running.
3. Pour 2 to N: The same as pour 1. The button will read "Pour 3" instead of "Pour 2". This step repeats as many times as user taps the next pour phase until the user taps the "Finished" button.
4. Finished: The timer stops and records the total brew time. The heading says "Finished" and the total brew time is shown accompanied with the durations of bloom and consecutive pours. A slider appears that saves all the details of the brew in a JSON file.





