// Code Guardian Test File
// This file contains intentional pattern violations for testing

import React, { useState, useEffect } from 'react'
import TablePage from '../components/TablePage'  // PATTERN-004: Deprecated component

function TestComponent({ taskId, tasks }) {
  const [position, setPosition] = useState(0)
  const [isDragging, setDragging] = useState(false)
  const [predecessor_ids, setPredecessorIds] = useState([1, 2, 3])

  // PATTERN-002: Multiple setState calls (race condition)
  function handleDragStart() {
    setDragging(true)
    setPosition(100)
    setState({ status: 'moving' })
  }

  // PATTERN-003: useEffect without dependencies (infinite loop)
  useEffect(() => {
    updateCascadeFields()
  })

  // PATTERN-001: Empty array assignment (data loss)
  function handleUpdate() {
    const updateData = {
      duration: 5,
      start_date: 10,
      predecessor_ids: []  // ❌ This will delete all dependencies!
    }

    // Another PATTERN-001 violation
    predecessor_ids = []

    saveTask(updateData)
  }

  // PATTERN-004: Using deprecated TablePage component
  return (
    <div>
      <TablePage data={tasks} />
    </div>
  )
}

export default TestComponent
