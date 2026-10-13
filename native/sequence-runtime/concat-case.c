    case BUILTIN_SEQUENCE_CONCAT:
      if (argc != 2 || args[0].type != VALUE_SEQUENCE || args[1].type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "sequence_concat expects two Sequences");
      else {
        if (args[0].sequence->count > SIZE_MAX - args[1].sequence->count) { vm_fail(vm, "RCL_NATIVE_OOM", "Concatenated Sequence is too large"); break; }
        /* Retain the left prefix; append only the right values. Reading or
         * exporting the result materializes it through the existing path. */
        sequence_materialize(args[1].sequence);
        result.type = VALUE_SEQUENCE;
        result.sequence = sequence_clone(args[0].sequence);
        for (size_t i = 0; i < args[1].sequence->count; i++) {
          Value next = value_sequence_append(result.sequence, &args[1].sequence->items[i]);
          sequence_free(result.sequence);
          result = next;
        }
      }
      break;
