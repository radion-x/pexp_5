const sanitize = (text: unknown): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/`/g, "'").trim();
};

export function generateComprehensivePrompt(formData: any): string {
  const patientName = sanitize(formData?.fullName || formData?.user?.name);
  const patientEmail = sanitize(formData?.email || formData?.user?.email);
  const treatmentGoals = sanitize(
    formData?.treatmentGoals ||
      formData?.goals?.goal2to4Weeks ||
      formData?.goals?.notes
  );

  let comprehensivePrompt = `
You are a clinical AI assistant analyzing a comprehensive pain assessment form.

PATIENT INFORMATION:
- Name: ${patientName || 'Not provided'}
- Email: ${patientEmail || 'Not provided'}
${formData?.user?.dateOfBirth ? `- Date of Birth: ${formData.user.dateOfBirth}` : ''}
${formData?.user?.phone ? `- Phone: ${formData.user.phone}` : ''}

PAIN MAPPING DATA:
`;

  const painAreas: any[] = Array.isArray(formData?.painAreas)
    ? formData.painAreas
    : [];
  const points: any[] = Array.isArray(formData?.points)
    ? formData.points
    : [];

  if (painAreas.length > 0) {
    painAreas.forEach((area) => {
      const region = sanitize(area?.region);
      const intensity = sanitize(String(area?.intensity ?? ''));
      const notes = sanitize(area?.notes);
      const qualities =
        Array.isArray(area?.qualities) && area.qualities.length > 0
          ? area.qualities.join(', ')
          : '';
      comprehensivePrompt += `- Region: ${region}, Intensity: ${intensity}/10`;
      if (qualities) {
        comprehensivePrompt += `, Quality: ${qualities}`;
      }
      if (notes) {
        comprehensivePrompt += `, Notes: ${notes}`;
      }
      comprehensivePrompt += `\n`;
    });
  } else if (points.length > 0) {
    points.forEach((point) => {
      const region = sanitize(point?.regionName || 'Unknown');
      const intensity = point?.intensityCurrent || 0;
      const qualities =
        Array.isArray(point?.qualities) && point.qualities.length > 0
          ? point.qualities.join(', ')
          : '';
      const radiates = sanitize(point?.radiatesTo);
      comprehensivePrompt += `- Region: ${region}, Intensity: ${intensity}/10`;
      if (qualities) {
        comprehensivePrompt += `, Quality: ${qualities}`;
      }
      if (radiates) {
        comprehensivePrompt += `, Radiates to: ${radiates}`;
      }
      comprehensivePrompt += `\n`;
    });
  } else if (Array.isArray(formData?.painPoints) && formData.painPoints.length) {
    formData.painPoints.forEach((point: any, index: number) => {
      const region = sanitize(point?.region || point?.originalName || `Point ${index + 1}`);
      const intensity = typeof point?.intensity === 'number' ? point.intensity : 'Not provided';
      comprehensivePrompt += `- Region: ${region}, Intensity: ${intensity}/10`;
      comprehensivePrompt += `\n`;
    });
  } else if (Array.isArray(formData?.selectedAreas) && formData.selectedAreas.length) {
    formData.selectedAreas.forEach((area: string) => {
      comprehensivePrompt += `- ${sanitize(area)}\n`;
    });
  } else {
    comprehensivePrompt += 'No pain areas marked\n';
  }

  if (formData?.timing) {
    const t = formData.timing;
    comprehensivePrompt += '\nPAIN TIMING & PATTERN:\n';
    if (t.onset) comprehensivePrompt += `- Onset: ${String(t.onset).replace(/_/g, ' ')}\n`;
    if (t.durationValue)
      comprehensivePrompt += `- Duration: ${t.durationValue} ${t.durationUnit || 'months'}\n`;
    if (typeof t.durationMonths === 'number') {
      const months = t.durationMonths;
      if (months < 1) comprehensivePrompt += '- Duration: Less than 1 month\n';
      else if (months < 12) comprehensivePrompt += `- Duration: ${months} month${months !== 1 ? 's' : ''}\n`;
      else {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        comprehensivePrompt += `- Duration: ${years} year${years !== 1 ? 's' : ''}${
          remainingMonths > 0 ? ` and ${remainingMonths} months` : ''
        }\n`;
      }
    }
    if (t.pattern) comprehensivePrompt += `- Pattern: ${t.pattern}\n`;
    if (t.frequency) comprehensivePrompt += `- Frequency: ${t.frequency}\n`;
    if (t.course) comprehensivePrompt += `- Course: ${t.course}\n`;
    if (Array.isArray(t.timeOfDay) && t.timeOfDay.length > 0) {
      comprehensivePrompt += `- Time of Day: ${t.timeOfDay.map((tod: string) => tod.replace(/_/g, ' ')).join(', ')}\n`;
    }
    if (t.baselineWithFlares) {
      comprehensivePrompt += '- Pattern: Baseline pain with flare-ups';
      if (t.flareLengthValue) {
        comprehensivePrompt += ` (flares last ${t.flareLengthValue} ${t.flareLengthUnit || 'hours'})`;
      }
      comprehensivePrompt += '\n';
    }
  }

  if (formData?.aggravators) {
    const agg = formData.aggravators;
    const aggFactors: string[] = [];
    if (agg.sitting) aggFactors.push('sitting');
    if (agg.standing) aggFactors.push('standing');
    if (agg.walking) aggFactors.push('walking');
    if (agg.bending) aggFactors.push('bending forward');
    if (agg.lifting) aggFactors.push('lifting');
    if (agg.twisting) aggFactors.push('twisting');
    if (agg.coughing) aggFactors.push('coughing/sneezing');
    if (agg.morningWorse) aggFactors.push('mornings');
    if (agg.eveningWorse) aggFactors.push('evenings');
    if (agg.weather) aggFactors.push('weather changes');
    if (agg.stress) aggFactors.push('stress');
    if (agg.other) aggFactors.push(sanitize(agg.other));

    if (aggFactors.length > 0) {
      comprehensivePrompt += `\nAGGRAVATING FACTORS:\n${aggFactors.map((f) => `- ${f}`).join('\n')}\n`;
    }
  }

  if (formData?.relievers) {
    const rel = formData.relievers;
    const relFactors: string[] = [];
    if (rel.rest) relFactors.push('rest');
    if (rel.ice) relFactors.push('ice');
    if (rel.heat) relFactors.push('heat');
    if (rel.stretching) relFactors.push('stretching');
    if (rel.movement) relFactors.push('movement');
    if (rel.medication) relFactors.push('medication');
    if (rel.position) relFactors.push(`position: ${sanitize(rel.position)}`);
    if (rel.other) relFactors.push(sanitize(rel.other));

    if (relFactors.length > 0) {
      comprehensivePrompt += `\nRELIEVING FACTORS:\n${relFactors.map((f) => `- ${f}`).join('\n')}\n`;
    }
  }

  if (formData?.associated) {
    const assoc = formData.associated;
    const symptoms: string[] = [];
    if (assoc.weakness) symptoms.push('Progressive weakness');
    if (assoc.numbness) symptoms.push('Numbness');
    if (assoc.tingling) symptoms.push('Tingling');
    if (assoc.balanceIssues) symptoms.push('Balance issues');
    if (assoc.morningStiffness30m) symptoms.push('Morning stiffness >30 min');
    if (assoc.feverChills) symptoms.push('Fever/chills');
    if (assoc.nightSweats) symptoms.push('Night sweats');
    if (assoc.fatigue) symptoms.push('Fatigue');
    if (assoc.swelling) symptoms.push('Swelling');
    if (assoc.rednessWarmth) symptoms.push('Redness/warmth');
    if (assoc.bruising) symptoms.push('Bruising');
    if (assoc.lockingCatching) symptoms.push('Joint locking/catching');
    if (assoc.instability) symptoms.push('Joint instability');
    if (assoc.headache) symptoms.push('Headache');
    if (assoc.lightSoundSensitive) symptoms.push('Light/sound sensitivity');
    if (assoc.visionChanges) symptoms.push('Vision changes');
    if (assoc.jawPain) symptoms.push('Jaw pain');
    if (assoc.chestPain) symptoms.push('Chest pain');
    if (assoc.shortnessBreath) symptoms.push('Shortness of breath');
    if (assoc.nauseaVomiting) symptoms.push('Nausea/vomiting');
    if (assoc.abdominalPain) symptoms.push('Abdominal pain');
    if (assoc.bowelChange) symptoms.push('Bowel changes');
    if (assoc.bladderChange) symptoms.push('Bladder changes');
    if (assoc.menstrualLink) symptoms.push('Menstrual cycle link');
    if (assoc.saddleNumbness) symptoms.push('Saddle numbness');
    if (assoc.incontinence) symptoms.push('Incontinence');

    if (symptoms.length > 0) {
      comprehensivePrompt += `\nASSOCIATED SYMPTOMS:\n${symptoms.map((s) => `- ${s}`).join('\n')}\n`;
    }
  }

  if (formData?.functional) {
    const func = formData.functional;
    comprehensivePrompt += '\nFUNCTIONAL IMPACT:\n';
    if (Array.isArray(func.limits) && func.limits.length > 0) {
      comprehensivePrompt += `- Limited activities: ${func.limits.join(', ')}\n`;
    }
    if (func.sitMinutes !== undefined) comprehensivePrompt += `- Can sit: ${func.sitMinutes} minutes\n`;
    if (func.standMinutes !== undefined) comprehensivePrompt += `- Can stand: ${func.standMinutes} minutes\n`;
    if (func.walkMinutes !== undefined) comprehensivePrompt += `- Can walk: ${func.walkMinutes} minutes\n`;
    if (func.missedDays7 !== undefined)
      comprehensivePrompt += `- Missed work/activities (last 7 days): ${func.missedDays7} days\n`;
    if (func.missedDays30 !== undefined)
      comprehensivePrompt += `- Missed work/activities (last 30 days): ${func.missedDays30} days\n`;
  }

  if (formData?.history) {
    const hist = formData.history;
    comprehensivePrompt += '\nMEDICAL HISTORY:\n';
    if (hist.recentInjury) {
      comprehensivePrompt += '- Recent injury: Yes';
      if (hist.injuryDate) comprehensivePrompt += ` (${hist.injuryDate})`;
      if (hist.mechanism) comprehensivePrompt += ` - ${sanitize(hist.mechanism)}`;
      comprehensivePrompt += '\n';
    }
    if (hist.repetitiveStrain) comprehensivePrompt += '- Repetitive strain/overuse: Yes\n';
    if (hist.newActivity) comprehensivePrompt += '- New activity/change in routine: Yes\n';
    if (hist.pregnancyPostpartum) comprehensivePrompt += '- Pregnancy/postpartum: Yes\n';
    if (hist.recurrent) {
      comprehensivePrompt += '- Recurrent pain: Yes';
      if (hist.priorDiagnosis) comprehensivePrompt += ` (prior diagnosis: ${sanitize(hist.priorDiagnosis)})`;
      comprehensivePrompt += '\n';
    }
    if (Array.isArray(hist.comorbidities) && hist.comorbidities.length > 0) {
      comprehensivePrompt += `- Medical conditions: ${hist.comorbidities.join(', ')}\n`;
    }
    if (Array.isArray(hist.currentMeds) && hist.currentMeds.length > 0) {
      comprehensivePrompt += '- Current medications:\n';
      hist.currentMeds.forEach((med: any) => {
        comprehensivePrompt += `  * ${sanitize(med?.name)}`;
        if (med?.dose) comprehensivePrompt += ` ${sanitize(med.dose)}`;
        if (med?.frequency) comprehensivePrompt += ` ${sanitize(med.frequency)}`;
        if (med?.helpful !== undefined)
          comprehensivePrompt += ` - ${med.helpful ? 'Helpful' : 'Not helpful'}`;
        if (med?.sideEffects) comprehensivePrompt += ` - Side effects: ${sanitize(med.sideEffects)}`;
        comprehensivePrompt += '\n';
      });
    }
    if (Array.isArray(hist.triedTreatments) && hist.triedTreatments.length > 0) {
      comprehensivePrompt += '- Prior treatments:\n';
      hist.triedTreatments.forEach((tx: any) => {
        comprehensivePrompt += `  * ${sanitize(tx?.name)}`;
        if (tx?.helpful !== undefined) comprehensivePrompt += ` - ${tx.helpful ? 'Helpful' : 'Not helpful'}`;
        if (tx?.sideEffects) comprehensivePrompt += ` - Side effects: ${sanitize(tx.sideEffects)}`;
        comprehensivePrompt += '\n';
      });
    }
    if (hist.sleepQuality) comprehensivePrompt += `- Sleep quality: ${hist.sleepQuality}\n`;
    if (hist.phq2 !== undefined) comprehensivePrompt += `- PHQ-2 (depression screen): ${hist.phq2}\n`;
    if (hist.gad2 !== undefined) comprehensivePrompt += `- GAD-2 (anxiety screen): ${hist.gad2}\n`;
    if (hist.stressHigh) comprehensivePrompt += '- High stress levels: Yes\n';
  }

  comprehensivePrompt += '\nRED FLAG SYMPTOMS:\n';
  if (formData?.redFlags) {
    const rf = formData.redFlags;
    if (rf.any) {
      comprehensivePrompt += '⚠️  RED FLAGS PRESENT\n';
      if (Array.isArray(rf.reasons) && rf.reasons.length > 0) {
        rf.reasons.forEach((reason: string) => {
          comprehensivePrompt += `- ${sanitize(reason)}\n`;
        });
      }
    } else {
      const redFlagLabels: Record<string, string> = {
        bowelBladderDysfunction: 'Bowel/Bladder Dysfunction',
        progressiveWeakness: 'Progressive Weakness',
        saddleAnesthesia: 'Saddle Anesthesia',
        unexplainedWeightLoss: 'Unexplained Weight Loss',
        feverChills: 'Fever/Chills',
        nightPain: 'Severe Night Pain',
        cancerHistory: 'History of Cancer',
        recentTrauma: 'Recent Trauma/Injury',
      };

      let hasPositiveRedFlags = false;
      Object.entries(redFlagLabels).forEach(([key, label]) => {
        if (rf[key]) {
          comprehensivePrompt += `⚠️  ${sanitize(label)}: YES\n`;
          hasPositiveRedFlags = true;
        }
      });

      if (!hasPositiveRedFlags) {
        comprehensivePrompt += '✓ No red flag symptoms reported\n';
      }
    }

    const redFlagNotes = sanitize(rf.notes);
    if (redFlagNotes) {
      comprehensivePrompt += `\nAdditional Notes: ${redFlagNotes}\n`;
    }
  } else {
    comprehensivePrompt += 'Red flags section not completed\n';
  }

  comprehensivePrompt += '\nTREATMENT GOALS:\n';
  if (treatmentGoals) {
    comprehensivePrompt += `${treatmentGoals}\n`;
  } else {
    comprehensivePrompt += 'Not specified by patient\n';
  }

  if (formData?.goals) {
    const goals = formData.goals;
    if (Array.isArray(goals.preferredTreatments) && goals.preferredTreatments.length > 0) {
      comprehensivePrompt += `- Preferred treatments: ${goals.preferredTreatments.join(', ')}\n`;
    }
    if (goals.exerciseReady !== undefined) {
      comprehensivePrompt += `- Ready for exercise: ${goals.exerciseReady ? 'Yes' : 'No'}\n`;
    }
  }

  comprehensivePrompt += `

=================================================================================
CLINICAL ANALYSIS INSTRUCTIONS:
=================================================================================
Your task is to provide a comprehensive clinical analysis for a healthcare provider.

ANALYSIS REQUIREMENTS:
1. **Pain Presentation**: Synthesize the pain location(s), intensity, quality, timing, and pattern
2. **Symptom Complex**: Integrate associated symptoms, aggravating/relieving factors
3. **Functional Impact**: Assess how pain affects daily activities and quality of life
4. **Medical Context**: Consider relevant history, comorbidities, and prior treatments
5. **Red Flag Assessment**: Evaluate urgency based on red flag symptoms:
   - HIGH_URGENCY: Bowel/bladder dysfunction, saddle anesthesia, progressive weakness, severe neurological deficits
   - MODERATE_URGENCY: Fever, unexplained weight loss, night pain, cancer history with new pain
   - LOW_URGENCY: No significant red flags
6. **Treatment Alignment**: Address patient's stated goals and treatment preferences
7. **Clinical Reasoning**: Provide differential considerations (NOT definitive diagnoses)
8. **Recommendations**: Suggest appropriate next steps and triage level

RESPONSE FORMAT:
Structure your response as follows:

**Clinical Overview**
[Synthesize the complete pain presentation in 2-3 sentences]

**Key Findings**
- Pain Pattern: [Distribution, quality, timing]
- Associated Features: [Relevant symptoms and functional impact]
- Medical Context: [Pertinent history and treatments]
- Red Flags: [List any present, or state "None identified"]

**Clinical Considerations**
[Discuss possible pathologies to consider - use conditional language, NOT definitive diagnoses]

**Recommendations**
- Urgency: [HIGH_URGENCY, MODERATE_URGENCY, or LOW_URGENCY]
- Next Steps: [Specific actions for healthcare provider]
- Patient Goals: [How to address treatment preferences]

Write professionally for a clinician audience. Be thorough but concise. Use clinical terminology appropriately.
`;

  return comprehensivePrompt;
}
