<?php

namespace App\AI;

enum CredentialStatus: string
{
    /** In the rotation. */
    case Active = 'active';

    /** Rate-limited or out of quota; back in the rotation at `available_at`. */
    case CoolingDown = 'cooling_down';

    /** The provider refused the key or the model. Stays out until edited or retried by hand. */
    case Invalid = 'invalid';

    /** Taken out by hand. */
    case Disabled = 'disabled';
}
