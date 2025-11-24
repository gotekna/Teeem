// Debug script for Gantt cascade testing
// Paste this into your browser console when on the Schedule Master Gantt view

async function debugCascade() {
  console.log('🔍 === GANTT CASCADE DEBUG ===');

  // Check if Gantt is available
  if (!window.gantt) {
    console.error('❌ Gantt instance not found. Please open the Gantt view first.');
    return;
  }

  console.log('✅ Gantt instance found');

  // Get all tasks
  const tasks = [];
  window.gantt.eachTask((task) => {
    tasks.push(task);
  });

  console.log(`📋 Found ${tasks.length} tasks in Gantt:`);
  tasks.forEach((task, idx) => {
    const links = window.gantt.getLinks().filter(l => l.source === task.id || l.target === task.id);
    const successors = links.filter(l => l.source === task.id);
    const predecessors = links.filter(l => l.target === task.id);

    console.log(`\nTask ${idx + 1}: "${task.text}" (ID: ${task.id})`);
    console.log(`  Start: ${task.start_date.toLocaleDateString()}`);
    console.log(`  Duration: ${task.duration} days`);
    console.log(`  Manually positioned: ${task.manually_positioned || false}`);
    console.log(`  Hold: ${task.hold || false}`);
    console.log(`  Predecessors: ${predecessors.length}`);
    console.log(`  Successors: ${successors.length}`);

    if (successors.length > 0) {
      successors.forEach(link => {
        const targetTask = window.gantt.getTask(link.target);
        const linkTypes = ['FS', 'SS', 'FF', 'SF'];
        console.log(`    → "${targetTask.text}" (${linkTypes[link.type] || 'FS'})`);
      });
    }
  });

  // Test moving Task 1 forward by 5 days
  console.log('\n🧪 === SIMULATING TASK 1 MOVE ===');
  const task1 = tasks[0];

  if (!task1) {
    console.error('❌ Task 1 not found');
    return;
  }

  console.log(`📍 Original Task 1 start: ${task1.start_date.toLocaleDateString()}`);

  // Store original dates of all tasks
  const originalDates = {};
  tasks.forEach(task => {
    originalDates[task.id] = {
      start: new Date(task.start_date),
      text: task.text
    };
  });

  // Calculate new start date (5 days forward)
  const newStartDate = new Date(task1.start_date);
  newStartDate.setDate(newStartDate.getDate() + 5);

  console.log(`📍 New Task 1 start: ${newStartDate.toLocaleDateString()}`);

  // Calculate day offset from project start (today)
  const projectStartDate = new Date();
  projectStartDate.setHours(0, 0, 0, 0);
  const dayOffset = Math.floor((newStartDate - projectStartDate) / (1000 * 60 * 60 * 24));

  console.log(`📍 Day offset: ${dayOffset}`);

  // Check for template ID
  const templateIdMatch = window.location.pathname.match(/schedule-templates\/(\d+)/);
  const templateId = templateIdMatch ? parseInt(templateIdMatch[1]) : null;

  if (!templateId) {
    console.error('❌ Could not determine template ID from URL');
    return;
  }

  console.log(`📋 Template ID: ${templateId}`);

  // Call the backend API to move task and trigger cascade
  console.log('\n🚀 Calling backend API to move Task 1 and cascade...');

  try {
    const response = await fetch(`https://trapid-backend-447058022b51.herokuapp.com/api/v1/schedule_templates/${templateId}/rows/${task1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedule_template_row: {
          start_date: dayOffset,
          duration: task1.duration,
          manually_positioned: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API call failed:', response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Backend response received:');
    console.log('Main task:', data.task || data);
    console.log('Cascaded tasks:', data.cascaded_tasks || []);

    const cascadedTasks = data.cascaded_tasks || [];
    console.log(`\n📊 Backend cascaded ${cascadedTasks.length} task(s)`);

    // Apply updates to Gantt
    const tasksToUpdate = [data.task || data];
    if (data.cascaded_tasks) {
      tasksToUpdate.push(...data.cascaded_tasks);
    }

    console.log('\n🔄 Applying updates to Gantt...');
    tasksToUpdate.forEach(taskData => {
      const ganttTask = window.gantt.getTask(taskData.id);
      if (ganttTask) {
        const date = new Date(projectStartDate);
        date.setDate(date.getDate() + taskData.start_date);

        const oldDate = ganttTask.start_date;
        ganttTask.start_date = date;
        ganttTask.duration = taskData.duration;
        window.gantt.updateTask(ganttTask.id);

        const daysMoved = Math.round((date - originalDates[taskData.id].start) / (1000 * 60 * 60 * 24));
        console.log(`  Task "${originalDates[taskData.id].text}": ${originalDates[taskData.id].start.toLocaleDateString()} → ${date.toLocaleDateString()} (moved ${daysMoved} days)`);
      }
    });

    console.log('\n✅ === CASCADE DEBUG COMPLETE ===');
    console.log(`\nSummary:`);
    console.log(`  - Task 1 moved: 5 days forward`);
    console.log(`  - Backend cascaded: ${cascadedTasks.length} tasks`);
    console.log(`  - Gantt updated: ${tasksToUpdate.length} tasks`);

    // Wait a moment then check final state
    setTimeout(() => {
      console.log('\n🔍 Final task positions:');
      tasks.forEach((task, idx) => {
        const ganttTask = window.gantt.getTask(task.id);
        const daysMoved = Math.round((ganttTask.start_date - originalDates[task.id].start) / (1000 * 60 * 60 * 24));
        console.log(`  Task ${idx + 1} "${task.text}": moved ${daysMoved} days`);
      });
    }, 500);

  } catch (error) {
    console.error('❌ Error during cascade test:', error);
  }
}

// Run the debug
debugCascade();
