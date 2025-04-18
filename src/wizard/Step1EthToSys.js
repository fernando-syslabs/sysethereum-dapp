import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import Web3 from 'web3';
import AppContext from '../AppContext';
import assetabierc20 from '../SyscoinERC20I';
import assetabierc721 from '../SyscoinERC721I';
import assetabierc1155 from '../SyscoinERC1155I';
import erc20Managerabi from '../SyscoinERC20Manager';
import CONFIGURATION from '../config';
import detectEthereumProvider from '@metamask/detect-provider';

const sjs = require("syscoinjs-lib");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const storageExists = typeof Storage !== 'undefined';

// --- Utility Functions ---
const isString = (s) => typeof s === 'string' || s instanceof String;

const toBaseUnit = (value, decimals, BN_Constructor) => {
  if (!isString(value)) {
    console.error("Pass strings to prevent floating point precision issues.");
    return undefined;
  }
  if (!BN_Constructor) {
    console.error("BN constructor not provided to toBaseUnit");
    return undefined;
  }
  try {
    const ten = new BN_Constructor(10);
    const base = ten.pow(new BN_Constructor(decimals));
    let negative = value.substring(0, 1) === "-";
    if (negative) value = value.substring(1);
    if (value === ".") throw new Error(`Invalid value ${value}`);
    let comps = value.split(".");
    if (comps.length > 2) throw new Error("Too many decimal points");
    let whole = comps[0] || "0";
    let fraction = comps[1] || "0";
    if (fraction.length > decimals) throw new Error("Too many decimal places");
    while (fraction.length < decimals) fraction += "0";
    whole = new BN_Constructor(whole);
    fraction = new BN_Constructor(fraction);
    let wei = whole.mul(base).add(fraction);
    if (negative) wei = wei.neg();
    return wei;
  } catch (error) {
    console.error(`Error converting value "${value}" to base unit: ${error.message}`);
    return undefined;
  }
};

// --- Consolidated LocalStorage ---
const persistableFields = [
  'assetType', 'sysxContract', 'tokenId', 'toSysAmount',
  'receiptTxHash', 'sysxFromAccount', 'syscoinWitnessAddress'
];

// --- Centralized Validators ---
const validators = {
  isValidEthereumAddress: (address) => typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address),
  isValidSyscoinAddress: (address) => typeof address === 'string' && address.trim().length > 30,
  isValidAmount: (amount, web3) => {
    if (!amount || amount.toString().trim() === '') return false;

    try {
      if (web3?.utils?.BN) {
        // Use a known decimals or make it generic for basic > 0 check
        // The original check used 18, let's stick to that for consistency here
        const amountBN = toBaseUnit(amount.toString(), 18, web3.utils.BN); 
        return amountBN && amountBN.gt(new web3.utils.BN(0));
      } else {
        // Fallback for when web3 or BN isn't available (as in original)
        const amountNum = parseFloat(amount);
        return !isNaN(amountNum) && amountNum > 0;
      }
    } catch (e) {
      return false;
    }
  },
  isValidTokenId: (tokenId) => {
    const tokenIdNum = parseInt(tokenId, 10);
    return tokenId != null && tokenId.toString().trim() !== '' && !isNaN(tokenIdNum) && tokenIdNum >= 0;
  }
};

// --- Helper function to generate validation classes (Matching original structure) ---
const getValidationClasses = (isValid, hasMessage = false, isWorking = false, isButton = false) => {
  const mainClass = !isValid ? "has-error" : "has-success";

  if (isButton) {
    // Mimic the exact logic from the original `notValidClasses` for the button
    const tooltipClass = !isValid || (hasMessage && !isWorking) // && !receiptTxHash ? - This condition was implicitly handled by message content in original
      ? "val-err-tooltip mb30"
      : (hasMessage ? "val-info-tooltip mb30" : "val-success-tooltip mb30");
    return {
      buttonCls: mainClass,
      buttonValGrpCls: tooltipClass
    };
  }

  // For regular fields
  return {
    mainCls: mainClass,
    valGrpCls: !isValid ? "val-err-tooltip" : "val-success-tooltip"
  };
};


// Component Start
const Step1ES = ({ getStore, updateStore, jumpToStep, t }) => {
  const { ethToSysDisplay } = useContext(AppContext);
  const store = getStore();

  // --- Consolidated State Initialization ---
  const getStoredValue = useCallback((key, defaultValue = "") => {
    // Prioritize store, then localStorage, then default
    if (store && store[key] !== undefined && store[key] !== null) return store[key];
    if (storageExists) {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) return storedValue;
    }
    return defaultValue;
    }, [store]); // store is a dependency

  // --- Wallets addresses store
  const [walletAddresses, setWalletAddresses] = useState({
    pali: '',  // Current Pali wallet address
    nevm: ''   // Current NEVM wallet address
  });

  // Consolidated Form Field Handling
  const [formState, setFormState] = useState({
    assetType: getStoredValue('assetType', 'SYS'),
    sysxContract: getStoredValue('sysxContract', ""),
    tokenId: getStoredValue('tokenId', ""),
    toSysAmount: getStoredValue('toSysAmount', ""),
    sysxFromAccount: getStoredValue('sysxFromAccount', ""),
    syscoinWitnessAddress: getStoredValue('syscoinWitnessAddress', ""),
    receiptTxHash: getStoredValue('receiptTxHash', ""),
    // receiptStatus: getStoredValue('receiptStatus', ''), // Keep if needed, wasn't actively used in validation/render logic shown
    working: false // Transient state, not persisted intentionally here
  });

  // Unified validation state (matching original state variable structure)
  const [validationState, setValidationState] = useState({
    button: { isValid: true, message: '' }, // Start valid, like original buttonVal
    sysxFromAccount: { isValid: true, message: '' }, // Matches sysxFromAccountVal, sysxFromAccountValMsg
    sysxContract: { isValid: true, message: '' }, // Matches sysxContractVal, sysxContractValMsg
    tokenId: { isValid: true, message: '' }, // Matches tokenIdVal, tokenIdValMsg
    toSysAmount: { isValid: true, message: '' }, // Matches toSysAmountVal, toSysAmountValMsg
    syscoinWitnessAddress: { isValid: true, message: '' } // Matches syscoinWitnessAddressVal, syscoinWitnessAddressValMsg
  });

  // Refs & Web3 State
  const web3InstanceRef = useRef(null);
  const providerRef = useRef(null);
  const currentChainIdRef = useRef(null);

  // Consolidated LocalStorage Usage
  const persistState = useCallback((name, value) => {
    if (persistableFields.includes(name)) {
      if (storageExists) {
        try {
          localStorage.setItem(name, value);
        } catch (e) {
          console.warn("LocalStorage is potentially full or unavailable.", e);
        }
      }
      // Update the central store passed via props
      if (updateStore) {
        updateStore({ [name]: value, savedToCloud: false });
      } else {
        console.warn("updateStore function not provided");
      }
    }
  }, [updateStore]); // updateStore is a dependency

  // Unified form update function
  const updateFormField = useCallback((name, value) => {
    setFormState(prev => ({ ...prev, [name]: value }));
    persistState(name, value);

    // Reset button validation message on *any* field change, unless it's a TX hash message
    // Mimics original `setButtonValMsg('')` in handlers
    setValidationState(prev => {
      const currentButtonMsg = prev.button.message || '';
      const keepMessage = currentButtonMsg.includes(t("step3ReceiptTxHash")) || currentButtonMsg.includes("Transaction timed out"); // Preserve specific messages
      return {
        ...prev,
        button: { ...prev.button, message: keepMessage ? currentButtonMsg : '' }
      }
    });
  }, [persistState, t]); // t is a dependency

  // Unified input handler
  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    updateFormField(name, value);
    // Validation is triggered by useEffect watching formState
  }, [updateFormField]);


  // --- Wallet Interaction & State Updates (using unified state) ---
  const updateNEVMAddress = useCallback((account) => {
    updateFormField('sysxFromAccount', account);
    // Reset specific field validation & potentially button message (handled by updateFormField)
    setValidationState(prev => ({
      ...prev,
      sysxFromAccount: { isValid: true, message: '' },
      // button message reset handled in updateFormField
    }));
  }, [updateFormField]);

  const updateUTXOAddress = useCallback((account) => {
    updateFormField('syscoinWitnessAddress', account);
     // Reset specific field validation & potentially button message (handled by updateFormField)
     setValidationState(prev => ({
      ...prev,
      syscoinWitnessAddress: { isValid: true, message: '' },
      // button message reset handled in updateFormField
    }));
  }, [updateFormField]);


  // Asset Type Change Handler (adapted for unified state)
  const handleAssetTypeChange = useCallback((event) => {
    const newAssetType = event.target.value;
    const previousAssetType = formState.assetType;

    // Update asset type first
    updateFormField('assetType', newAssetType);

    // Adjust related fields - use updateFormField to ensure persistence
    if (newAssetType === 'SYS') {
      if (formState.sysxContract) updateFormField('sysxContract', '');
    }
    if (newAssetType !== 'ERC721' && newAssetType !== 'ERC1155') {
      if (formState.tokenId) updateFormField('tokenId', '');
    }
    if (newAssetType === 'ERC721') {
      // Only update if it's not already '1'
      if (formState.toSysAmount !== '1') updateFormField('toSysAmount', '1');
    } else if (previousAssetType === 'ERC721' && formState.toSysAmount === '1') {
      // Clear amount if switching away from ERC721 where amount was '1'
      updateFormField('toSysAmount', '');
    }

    // Reset validation states for potentially affected fields (mimics original)
    setValidationState(prev => ({
      ...prev,
      sysxContract: { isValid: true, message: '' },
      tokenId: { isValid: true, message: '' },
      toSysAmount: { isValid: true, message: '' },
      button: { ...prev.button, message: '' } // Reset button message too
    }));
    // The useEffect watching formState will re-run full validation
  }, [formState.assetType, formState.sysxContract, formState.tokenId, formState.toSysAmount, updateFormField]);


  // --- Wallet Connection Logic (adapted for unified state) ---
  const connectPaliWallet = useCallback(async () => {
    if (!window.pali) {
      console.error("Pali wallet not detected.");
      // Set button message directly, as in original
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2InstallPali") } }));
      return;
    }
    try {
      const accountInfo = await window.pali.request({ method: 'wallet_getAccount' });
      if (accountInfo && accountInfo.address) {
        updateUTXOAddress(accountInfo.address); // This resets field validation and button message
      } else {
        const accounts = await window.pali.request({ method: 'sys_requestAccounts' });
        if (accounts && accounts.length > 0) {
          const newAccountInfo = await window.pali.request({ method: 'wallet_getAccount' });
           if (newAccountInfo && newAccountInfo.address) {
             updateUTXOAddress(newAccountInfo.address); // This resets field validation and button message
           } else {
             throw new Error("Could not get address after requesting accounts.");
           }
        } else {
          // Set field and button validation state directly, like original
          setValidationState(prev => ({ ...prev,
            syscoinWitnessAddress: { isValid: false, message: '' }, // Original didn't set a field msg here
            button: { isValid: false, message: t("step2SelectPaliAccount") }
          }));
        }
      }
    } catch (connectError) {
      console.error('Failed to connect/get account from Pali wallet:', connectError);
      // Set field and button validation state directly, like original
      setValidationState(prev => ({ ...prev,
        syscoinWitnessAddress: { isValid: false, message: '' }, // Original didn't set a field msg here
        button: { isValid: false, message: t("step2UnlockPali") }
      }));
    }
  }, [t, updateUTXOAddress]); // Dependencies

  const connectNEVMWallet = useCallback(async (provider) => {
    if (!provider) {
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3InstallMetamask") } }));
      return;
    }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        updateNEVMAddress(accounts[0]); // Resets field validation and button message
      } else {
        // Set field and button validation state directly, like original
        setValidationState(prev => ({ ...prev,
          sysxFromAccount: { isValid: false, message: '' }, // Original didn't set field msg here
          button: { isValid: false, message: t("step3LoginMetamask") }
        }));
      }
    } catch (error) {
      console.error('Failed to connect NEVM wallet:', error);
      // Set field and button validation state directly, like original
      setValidationState(prev => ({ ...prev,
        sysxFromAccount: { isValid: false, message: '' }, // Original didn't set field msg here
        button: { isValid: false, message: t("step3LoginMetamask") }
      }));
    }
  }, [t, updateNEVMAddress]); // Dependencies

  // --- Event Handlers (adapted for unified state) ---
  const handleAccountsChanged = useCallback((accounts) => {
    const account = accounts?.[0] || '';
    setWalletAddresses(prev => ({ ...prev, nevm: account }));

    // Only update form if already set (preserves user control)
    if (formState.sysxFromAccount && formState.sysxFromAccount !== account) {
      // Show suggestion but don't automatically update
    } else if (!formState.sysxFromAccount && account) {
      // Auto-populate empty field
      updateNEVMAddress(account);
    } else if (!account && formState.sysxFromAccount) {
      setValidationState(prev => ({
        ...prev,
        sysxFromAccount: { isValid: false, message: ''},
        button: { isValid: false, message: t("step3LoginMetamask") }
      }));
    }
  }, [t, updateNEVMAddress, formState.sysxFromAccount]);


  // Unified validation function - translates field name to validation result
  const validateField = useCallback((fieldName, value, context = {}) => {
    const { assetType, web3 } = context;

    switch(fieldName) {
    case 'sysxFromAccount':
      return {
        isValid: !!value && validators.isValidEthereumAddress(value),
        message: !value ? t("step1ESEnterFromAccount") :
          !validators.isValidEthereumAddress(value) ? t("step2EthAddress") : ""
      };
    case 'syscoinWitnessAddress':
      return {
        isValid: !!value && validators.isValidSyscoinAddress(value),
        message: !value ? t("step1ESEnterWitnessAddress") :
          !validators.isValidSyscoinAddress(value) ? t("step2FundingAddress") : ""
      };
    case 'sysxContract':
      if (assetType === 'SYS') return { isValid: true, message: "" };
      return {
        isValid: !!value && validators.isValidEthereumAddress(value),
        message: !value ? t("step1ESEnterSYSXContract") :
          !validators.isValidEthereumAddress(value) ? t("step2SYSXContract") : ""
      };
    case 'tokenId':
      if (assetType !== 'ERC721' && assetType !== 'ERC1155') return { isValid: true, message: "" };
      return {
        isValid: validators.isValidTokenId(value),
        message: !validators.isValidTokenId(value) ? t("step2TokenId") : "" // Original only had one message
      };
    case 'toSysAmount':
      if (assetType === 'ERC721') return { isValid: true, message: "" }; // Amount fixed to 1 for ERC721
      return {
        isValid: validators.isValidAmount(value, web3), // Use the centralized validator
        message: !validators.isValidAmount(value, web3) ? t("step2Amount") : "" // Original only had one message
      };
    default:
      return { isValid: true, message: "" };
    }
  }, [t]); // t is a dependency

  // Comprehensive validation check - *replaces* validationCheck, mimics its logic closely
  const validateAllFields = useCallback(() => {
    const { assetType, sysxContract, tokenId, toSysAmount, sysxFromAccount, syscoinWitnessAddress, working, receiptTxHash } = formState;
    const web3 = web3InstanceRef.current;
    const context = { assetType, web3 };
    let overallValid = true; // Assume valid initially, like original
    let buttonMessage = ''; // Store potential button message

    // Calculate individual field validations
    const newValidations = {
      sysxFromAccount: validateField('sysxFromAccount', sysxFromAccount, context),
      syscoinWitnessAddress: validateField('syscoinWitnessAddress', syscoinWitnessAddress, context),
      sysxContract: validateField('sysxContract', sysxContract, context),
      tokenId: validateField('tokenId', tokenId, context),
      toSysAmount: validateField('toSysAmount', toSysAmount, context),
      button: { isValid: true, message: '' } // Start button fresh
    };

    // Check if any field validation failed
    if (!newValidations.sysxFromAccount.isValid) overallValid = false;
    if (!newValidations.syscoinWitnessAddress.isValid) overallValid = false;
    if (!newValidations.sysxContract.isValid) overallValid = false;
    if (!newValidations.tokenId.isValid) overallValid = false;
    if (!newValidations.toSysAmount.isValid) overallValid = false;

    // Check wallet/chain conditions (mimics original `validationCheck`)
    const targetChainIdNum = CONFIGURATION.ChainId ? parseInt(CONFIGURATION.ChainId, 16) : null;
    const currentChainIdNum = currentChainIdRef.current ? parseInt(currentChainIdRef.current, 16) : null;

    if (!providerRef.current) {
      buttonMessage = t("step3InstallMetamask");
      overallValid = false;
    } else if (!currentChainIdNum) { // Check if connected/chainId available
      buttonMessage = t("step3LoginMetamask");
      overallValid = false;
    } else if (!sysxFromAccount) { // Added check - if provider exists but no account, invalid
      buttonMessage = t("step3LoginMetamask"); // Re-use login message
      overallValid = false;
    } else if (targetChainIdNum && currentChainIdNum !== targetChainIdNum) {
      buttonMessage = t("stepUseMainnet");
      overallValid = false;
    }

    // Set the final validation state
    newValidations.button.isValid = overallValid;

    // Set button message: prioritize specific errors, otherwise keep empty if valid
    // Don't overwrite specific messages set during operations (like tx hash or working)
    const existingButtonMsg = validationState.button.message || '';
    const keepExistingMsg = existingButtonMsg.includes(t("step3ReceiptTxHash")) || existingButtonMsg.includes("timed out") || existingButtonMsg.includes(t("step2PleaseSign")) || existingButtonMsg.includes("Checking allowance") || existingButtonMsg.includes("Approval"); // Preserve operational messages

    if (keepExistingMsg) {
      newValidations.button.message = existingButtonMsg;
      newValidations.button.isValid = false; // Operation in progress or completed, button usually disabled
    } else if (buttonMessage) { // If we got a wallet/chain error
      newValidations.button.message = buttonMessage;
    } else if (!overallValid) {
      // Find the *first* field error message if no specific button message exists
      const firstError = Object.entries(newValidations)
        .find(([key, val]) => key !== 'button' && !val.isValid);
      newValidations.button.message = firstError ? firstError[1].message : t("genericError"); // Fallback message
    } else {
      newValidations.button.message = ''; // All valid, clear message
    }

    setValidationState(newValidations);
    return overallValid; // Return the validity status

  // Dependencies: Recalculate whenever form state changes, or t changes, or the validateField function itself changes (due to t changing)
  // Also add validationState.button.message to deps? To re-evaluate if the message should be kept.
  }, [formState, t, validateField, validationState.button.message]);

  const handleChainChanged = useCallback((chainIdHex) => {
    console.log("Network changed to:", chainIdHex);
    currentChainIdRef.current = chainIdHex;
    if (providerRef.current) {
      web3InstanceRef.current = new Web3(providerRef.current);
    }
    // Explicitly call validateAllFields to ensure immediate validation after chain change
    validateAllFields();
  }, [validateAllFields]);


  // --- Effects ---
  // Effect for Initial Web3 Setup and Listener Registration
  useEffect(() => {
    let isMounted = true;
    const initWeb3 = async () => {
      try {
        const detectedProvider = await detectEthereumProvider({ mustBeMetaMask: false, silent: true });
        if (detectedProvider && isMounted) {
          providerRef.current = detectedProvider;
          const web3 = new Web3(detectedProvider);
          web3InstanceRef.current = web3;
          let chainIdHex = null;
          try {
             const chainId = await web3.eth.getChainId();
             chainIdHex = `0x${chainId.toString(16)}`;
          } catch (err) { console.warn("Could not get chain ID on init:", err); }

          if (isMounted) currentChainIdRef.current = chainIdHex; // Update ref if mounted
          let accounts = [];
          try {
            accounts = await web3.eth.getAccounts();
          } catch (err) { console.warn("Could not get accounts on init (maybe locked?):", err); }

          if (accounts && accounts.length > 0 && isMounted) {
            // Track the available NEVM address in a separate state
            setWalletAddresses(prev => ({ ...prev, nevm: accounts[0] }));
          } else if (isMounted) {
            // No accounts available, clear the tracked NEVM address
            setWalletAddresses(prev => ({ ...prev, nevm: '' }));

            // If form had an address but now none is available, clear it
            if (formState.sysxFromAccount) {
              handleAccountsChanged([]);
            }
          }

          // Setup listeners
          if (providerRef.current.on) {
            providerRef.current.on('accountsChanged', handleAccountsChanged);
            providerRef.current.on('chainChanged', handleChainChanged);
          }
        } else if (isMounted) {
          console.log('Please install a Web3 provider (e.g., MetaMask).');
          // Validation will catch providerRef.current being null
        }
      } catch (error) {
        console.error("Error initializing Web3:", error);
        if (isMounted) {
          // Set a generic error on the button if init fails badly
          setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("genericError") } }));
        }
      } finally {
         // Run validation after initialization attempt is complete
         if (isMounted) {
           validateAllFields();
         }
      }
    };
    initWeb3();
    return () => {
      isMounted = false;
      if (providerRef.current && providerRef.current.removeListener) {
        providerRef.current.removeListener('accountsChanged', handleAccountsChanged);
        providerRef.current.removeListener('chainChanged', handleChainChanged);
      }
    };
  // Run only on mount and if handlers/t change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.sysxFromAccount, handleAccountsChanged, handleChainChanged, updateNEVMAddress, validateAllFields, t]);


  // Effect to run validation whenever formState changes or chainId changes (indirectly via re-render)
  // This replaces the individual useEffects calling validationCheck in the original
  useEffect(() => {
    validateAllFields();
  }, [formState, validateAllFields, currentChainIdRef.current]); // Re-run validation if form state changes or the validation function changes



  // Effect for Pali Wallet Check
  useEffect(() => {
    const checkPali = async () => {
      if (window.pali && window.pali.isBitcoinBased) {
        try {
          const accountInfo = await window.pali.request({ method: 'wallet_getAccount' }).catch(() => null);

          if (accountInfo && accountInfo.address) {
            // Update tracked wallet address state
            setWalletAddresses(prev => ({ ...prev, pali: accountInfo.address }));
          } else {
            // Clear tracked Pali address if disconnected
            setWalletAddresses(prev => ({ ...prev, pali: '' }));

            // Clear form field only if it was previously populated
            if (formState.syscoinWitnessAddress && !accountInfo?.address) {
              updateUTXOAddress('');
            }
          }
        } catch (e) {
          console.error("Error checking Pali address:", e);
          setWalletAddresses(prev => ({ ...prev, pali: '' }));

          // Only clear form field if error and field was populated
          if (formState.syscoinWitnessAddress) {
            updateUTXOAddress('');
          }
        }
      } else {
        // No Pali wallet detected
        setWalletAddresses(prev => ({ ...prev, pali: '' }));

        // Only clear if field was populated
        if (formState.syscoinWitnessAddress) {
          updateUTXOAddress('');
        }
      }
    };

    // Only run check if this component part is displayed
    if (ethToSysDisplay) {
      checkPali();
    }
  // Dependencies adjusted to include walletAddresses
  }, [ethToSysDisplay, updateUTXOAddress, formState.syscoinWitnessAddress]);



  // --- Transaction Submission (adapted, minimal changes to core logic/messages) ---
  const freezeBurn = useCallback(async (
    syscoinERC20Manager,
    amountBN,
    contractAddress, // Use local names for clarity
    nftId,
    witnessAddress,
    nevFromAccount
  ) => {
    // Set working state and initial message
    setFormState(prev => ({ ...prev, working: true }));
    setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2PleaseSign") }}));

    const txValue = (formState.assetType === 'SYS') ? amountBN : undefined;
    const contractAddrToSend = contractAddress || ZERO_ADDRESS;
    const tokenIdToSend = nftId || 0;
    const amountString = amountBN.toString();

    try {
      // Use estimated gas + buffer
      const gasEstimate = await syscoinERC20Manager.methods
        .freezeBurn(amountString, contractAddrToSend, tokenIdToSend, witnessAddress)
        .estimateGas({ from: nevFromAccount, value: txValue });
      const gasLimit = Math.ceil(gasEstimate * 1.2); // 20% buffer is reasonable

      syscoinERC20Manager.methods
        .freezeBurn(amountString, contractAddrToSend, tokenIdToSend, witnessAddress)
        .send({ from: nevFromAccount, gas: gasLimit, value: txValue, transactionPollingTimeout: 1800 }) // Keep timeout
        .once("transactionHash", (hash) => {
          console.log("Transaction Hash:", hash);
          // Don't set working: false yet
          updateFormField('receiptTxHash', hash); // Persists and updates state
          setValidationState(prev => ({...prev, button: { isValid: false, message: t("step3ReceiptTxHash") + ": " + hash }}));

          if (jumpToStep) {
            jumpToStep(1); // Navigate away
          } else {
             console.warn("jumpToStep function not provided");
             // Button message already set
          }
        })
        .on("error", (error) => {
          console.error("Freeze/Burn Error:", error);
          setFormState(prev => ({ ...prev, working: false }));
          let message = error.message || t("genericError");
          if (message.length <= 512 && message.indexOf("{") !== -1) {
            try {
              const nestedError = JSON.parse(message.substring(message.indexOf("{")));
              message = nestedError.message || message;
            } catch (e) {/* ignore */}
          }
          let finalButtonMsg;
          if (message.indexOf("might still be mined") === -1 && message.indexOf("transactionPollingTimeout") === -1) {
             finalButtonMsg = t("genericError") + message.substring(0, 100) + (message.length > 100 ? "..." : "");
             // Clear receipt hash only on non-timeout errors where it wasn't set yet or should be cleared
             updateFormField('receiptTxHash', '');
          } else {
             // Keep the existing receipt hash from formState if available for timeout message
             finalButtonMsg = "Transaction timed out. Check explorer: " + formState.receiptTxHash;
             // Don't clear receipt hash on timeout
          }
           setValidationState(prev => ({...prev, button: { isValid: false, message: finalButtonMsg }}));
        });
    } catch (err) {
      console.error("Error estimating gas or sending transaction:", err);
      setFormState(prev => ({ ...prev, working: false }));
      let errorMsg = t("genericError") + (err.message || "Please try again...");
      // Clear receipt hash on estimation/send error
      updateFormField('receiptTxHash', '');
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: errorMsg } }));
    }
  // Dependencies reflect used state/props/functions
  }, [formState.assetType, formState.receiptTxHash, t, updateFormField, jumpToStep]);

  const submitProofs = useCallback(async () => {
    // Re-run validation and check button state directly
    const fieldsAreValid = validateAllFields(); // This updates validationState
    if (!fieldsAreValid) {
      // Message should already be set by validateAllFields
      console.warn("Submission attempt with invalid fields.");
      if (!validationState.button.message) { // Safety check for message
         setValidationState(prev => ({ ...prev, button: { ...prev.button, isValid: false, message: t("genericError") } }));
      }
      return;
    }

    if (!web3InstanceRef.current || !providerRef.current) {
      // This case should be caught by validateAllFields, but double-check
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3InstallMetamask") } }));
      return;
    }

    const web3 = web3InstanceRef.current;
    const BN = web3.utils.BN;

    setFormState(prev => ({ ...prev, working: true }));
    setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3AuthMetamask") } }));

    // --- Chain Check ---
    // The validation already checked the chain, proceed assuming it's correct or user handles it.
    // If we wanted to add switching, it would go here, but per the request, we avoid functional changes.

    // --- Transaction Preparation ---
    setValidationState(prev => ({ ...prev, button: { isValid: false, message: "Preparing Transaction..." } })); // Use a generic message

    let assetABI;
    let decimals = 18; // Default
    switch (formState.assetType) {
      case 'ERC721': assetABI = assetabierc721; decimals = 0; break;
      case 'ERC1155': assetABI = assetabierc1155; decimals = 0; break; // Assuming 0 decimals
      case 'ERC20': assetABI = assetabierc20; break;
      default: assetABI = assetabierc20; // Fallback (for SYS, though ABI isn't used)
    }

    const syscoinERC20Manager = new web3.eth.Contract(erc20Managerabi, CONFIGURATION.ERC20Manager);
    let contractBase = null;
    let amountBN;
    const nftId = (formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') ? formState.tokenId : '0';

    try {
      // Determine amount and setup contractBase if needed
      if (formState.assetType !== 'SYS' && formState.sysxContract) {
        contractBase = new web3.eth.Contract(assetABI, formState.sysxContract);
        if (formState.assetType === 'ERC20') {
          try { decimals = await contractBase.methods.decimals().call(); }
          catch (e) { console.warn("Could not fetch decimals for ERC20, assuming 18.", e); decimals = 18; }
        }
      }

      // Calculate amountBN based on type (after potentially fetching decimals)
      amountBN = (formState.assetType === 'ERC721')
        ? new BN(1)
        : toBaseUnit(formState.toSysAmount, decimals, BN); // Use determined/default decimals

      // Check amount during submission trigger.
      // A more robust check is in validateField.
      if (amountBN === undefined) {
         // This case should ideally be caught by validation
         console.error("Invalid amount provided during submission.");
         // Set validation state for amount and button
         setValidationState(prev => ({
           ...prev,
           toSysAmount: { isValid: false, message: t("step2Amount")},
           button: { isValid: false, message: t("step2Amount")}
         }));
         setFormState(prev => ({ ...prev, working: false }));
         return;
      }


      // --- Approval Logic ---
      if (formState.assetType === 'ERC20' && contractBase) {
        setValidationState(prev => ({ ...prev, button: { isValid: false, message: "Checking allowance..." } }));
        const allowance = await contractBase.methods.allowance(formState.sysxFromAccount, CONFIGURATION.ERC20Manager).call();
        const allowanceBN = new BN(allowance.toString());

        if (allowanceBN.lt(amountBN)) {
          setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3AuthAllowanceMetamask") } }));
          await contractBase.methods.approve(CONFIGURATION.ERC20Manager, amountBN.toString())
            .send({ from: formState.sysxFromAccount, gas: 100000 })
            .on("transactionHash", (hash) => {
              setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3AuthAllowanceMetamask") } }));
            })
            .on("receipt", (receipt) => {
               setValidationState(prev => ({ ...prev, button: { isValid: false, message: "Approval successful! Proceeding..." } })); // This seems like a reasonable interim message.
              freezeBurn(syscoinERC20Manager, amountBN, formState.sysxContract, nftId, formState.syscoinWitnessAddress, formState.sysxFromAccount);
            })
            .on("error", (error, receipt) => { throw new Error("Approval failed: " + (error.message || "User rejected")); });
          return; // Wait for approval
        }
      } else if ((formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') && contractBase) {
        setValidationState(prev => ({ ...prev, button: { isValid: false, message: "Checking NFT approval..." } })); // Interim message
        const isApproved = await contractBase.methods.isApprovedForAll(formState.sysxFromAccount, CONFIGURATION.ERC20Manager).call();
        if (!isApproved) {
          setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3AuthAllowanceMetamask") } }));
          await contractBase.methods.setApprovalForAll(CONFIGURATION.ERC20Manager, true)
            .send({ from: formState.sysxFromAccount, gas: 100000 })
            .on("transactionHash", (hash) => {
               setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3AuthAllowanceMetamask") } }));
            })
            .on("receipt", (receipt) => {
              setValidationState(prev => ({ ...prev, button: { isValid: false, message: "NFT Approval successful! Proceeding..." } })); // Interim message
              freezeBurn(syscoinERC20Manager, amountBN, formState.sysxContract, nftId, formState.syscoinWitnessAddress, formState.sysxFromAccount);
            })
            .on("error", (error, receipt) => { throw new Error("NFT Approval failed: " + (error.message || "User rejected")); });
          return; // Wait for approval
        }
      }

      // --- Call freezeBurn directly if no approval needed ---
      freezeBurn(syscoinERC20Manager, amountBN, formState.sysxContract, nftId, formState.syscoinWitnessAddress, formState.sysxFromAccount);

    } catch (error) {
      console.error("Error during approval check or execution:", error);
      setFormState(prev => ({ ...prev, working: false }));
      let errorMsg = t("genericError") + (error.message || "Please try again...");
      updateFormField('receiptTxHash', ''); // Clear hash on error
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: errorMsg } }));
    }
  // Dependencies reflect state/props/functions used
  }, [validateAllFields, validationState.button.message, t, providerRef, formState, toBaseUnit, freezeBurn, updateFormField]); // Added missing deps like providerRef


  // --- Render Logic ---
  // Extract CSS Class Generation (using the helper function)
  const fieldClasses = {
    button: getValidationClasses(
    validationState.button.isValid,
    !!validationState.button.message,
    formState.working,
    true // isButton = true
    ),
    toSysAmount: getValidationClasses(validationState.toSysAmount.isValid),
    syscoinWitnessAddress: getValidationClasses(validationState.syscoinWitnessAddress.isValid),
    sysxFromAccount: getValidationClasses(validationState.sysxFromAccount.isValid),
    tokenId: getValidationClasses(validationState.tokenId.isValid),
    sysxContract: getValidationClasses(validationState.sysxContract.isValid),
  };

  return (
    <div className="step step1es">
    <div className="row">
      <form id="Form" className="form-horizontal" onSubmit={(e) => e.preventDefault()}>
      <div className="form-group">
        {/* Header */}
        <label className="col-md-12">
        <h1>{t("step1ESHead")}</h1>
        <h3 dangerouslySetInnerHTML={{ __html: t("step1ESDescription") }}></h3>
        </label>

        {/* Asset Type */}
        <div className="row">
        <div className="col-md-12">
          <label className="control-label col-md-4">{t("assetTypeLabel")}</label>
          <div>
          <select
            name="assetType"
            className="form-control"
            value={formState.assetType}
            onChange={handleAssetTypeChange}
            disabled={formState.working}
          >
            <option value="SYS">SYS (Native)</option>
            <option value="ERC20">ERC20 Token</option>
            <option value="ERC721">ERC721 NFT</option>
            <option value="ERC1155">ERC1155 Multi-token</option>
          </select>
          </div>
        </div>
        </div>

        {/* SYSX Contract (Conditional) */}
        {formState.assetType !== 'SYS' && (
        <div className="row">
          <div className="col-md-12">
          <label className="control-label col-md-4">
            {t("step1ESSYSXContractLabel")}
          </label>
          {/* Apply classes directly */}
          <div className={fieldClasses.sysxContract.mainCls}>
            <input
            name="sysxContract"
            type="text"
            placeholder={t("step1ESEnterSYSXContract")}
            className="form-control"
            value={formState.sysxContract}
            onChange={handleInputChange}
            disabled={formState.working}
            />
            {/* Tooltip div */}
            <div className={fieldClasses.sysxContract.valGrpCls}>
            {validationState.sysxContract.message}
            </div>
          </div>
          </div>
        </div>
        )}

        {/* Token ID (Conditional) */}
        {(formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') && (
        <div className="row">
          <div className="col-md-12">
          <label className="control-label col-md-4">{t("tokenIdLabel")}</label>
          <div className={fieldClasses.tokenId.mainCls}>
            <input
            name="tokenId"
            type="number"
            min="0" step="1"
            placeholder={t("step1ESEnterToken")}
            className="form-control"
            value={formState.tokenId}
            onChange={handleInputChange}
            disabled={formState.working}
            />
            <div className={fieldClasses.tokenId.valGrpCls}>
            {validationState.tokenId.message}
            </div>
          </div>
          </div>
        </div>
        )}

        {/* From NEVM Account */}
        <div className="row">
        <div className="col-md-12">
          <label className="control-label col-md-4">
          {t("step1ESFromAccountLabel")}
          </label>
          <div className={fieldClasses.sysxFromAccount.mainCls}>
          <input
            name="sysxFromAccount"
            autoComplete="off"
            type="text"
            placeholder={t("step1ESEnterFromAccount")}
            className="form-control"
            value={formState.sysxFromAccount}
            onChange={handleInputChange}
            disabled={formState.working}
          />

          {/* Suggestion button for NEVM - prioritizing different states */}
          {formState.sysxFromAccount.toLowerCase() === walletAddresses.nevm.toLowerCase() ? (
            <span></span>
          ) : walletAddresses.nevm ? (
            // If wallet is connected but input has different/no address
            <button
              type="button"
              onClick={() => updateNEVMAddress(walletAddresses.nevm)}
              className="btn btn-default wallet-connect-btn"
              disabled={formState.working}
            >
              <span className="wallet-icon"></span>
              {walletAddresses.nevm.substring(0, 6)}...{walletAddresses.nevm.substring(38)}
            </button>
          ) : providerRef.current ? (
            // If provider exists but no wallet connected
            <button
              type="button"
              onClick={() => connectNEVMWallet(providerRef.current)}
              className="btn btn-default wallet-connect-btn"
              disabled={formState.working}
            >
              <span className="wallet-icon"></span>
              {t("connectNEVMWallet")}
            </button>
          ) : (
            // If no provider detected
            <div className="wallet-notice">{t("step3InstallMetamask")}</div>
          )}

          {/* Tooltip Div */}
          <div className={fieldClasses.sysxFromAccount.valGrpCls}>
            {validationState.sysxFromAccount.message}
          </div>
          </div>
        </div>
        </div>

        {/* Amount (Conditional) */}
        {formState.assetType !== 'ERC721' && (
        <div className="row">
          <div className="col-md-12">
          <label className="control-label col-md-4">
            {t("step2AmountLabel")}
          </label>
          <div className={fieldClasses.toSysAmount.mainCls}>
            <input
            name="toSysAmount"
            autoComplete="off"
            type="number"
            min="0" step="any"
            placeholder={t("step2EnterAmount")}
            className="form-control"
            required
            value={formState.toSysAmount}
            onChange={handleInputChange}
            disabled={formState.working || formState.assetType === 'ERC721'}
            />
            <div className={fieldClasses.toSysAmount.valGrpCls}>
            {validationState.toSysAmount.message}
            </div>
          </div>
          </div>
        </div>
        )}

        {/* Syscoin Witness Address */}
        <div className="row">
        <div className="col-md-12">
          <label className="control-label col-md-4">
          {t("step1ESWitnessAddressLabel")}
          </label>
          <div className={fieldClasses.syscoinWitnessAddress.mainCls}>
          <input
            name="syscoinWitnessAddress"
            autoComplete="off"
            type="text"
            placeholder={t("step1ESEnterWitnessAddress")}
            className="form-control"
            required
            value={formState.syscoinWitnessAddress}
            onChange={handleInputChange}
            disabled={formState.working}
          />

          {/* Suggestion button when Pali wallet address is available but not used */}
          {formState.syscoinWitnessAddress.toLowerCase() === walletAddresses.pali.toLowerCase() ? (
            <span></span>
          ) : walletAddresses.pali ? (
            // If wallet is connected but input has different/no address
            <button
              type="button"
              onClick={() => updateUTXOAddress(walletAddresses.pali)}
              className="btn btn-default wallet-connect-btn"
              disabled={formState.working}
            >
              <span className="wallet-icon"></span>
              {walletAddresses.pali.substring(0, 6)}...{walletAddresses.pali.substring(39)}
            </button>
          ) : window.pali ? (
            // If Pali is available but not connected
            <button
              type="button"
              onClick={connectPaliWallet}
              className="btn btn-default wallet-connect-btn"
              disabled={formState.working}
            >
              <span className="wallet-icon"></span>
              {t("connectPaliWallet")}
            </button>
          ) : (
            // If Pali is not available
            <div className="wallet-notice">{t("step2InstallPali")}</div>
          )}

          <div className={fieldClasses.syscoinWitnessAddress.valGrpCls}>
            {validationState.syscoinWitnessAddress.message}
          </div>
          </div>
        </div>
        </div>

        {/* Submit Button Area */}
        <div className="row">
        <div className="col-md-4 col-sm-12 col-centered">
          <div className={fieldClasses.button.buttonCls}>
          <button
            disabled={formState.working || !validationState.button.isValid}
            type="button"
            className="form-control btn btn-default formbtn"
            aria-label={t("step1ESButton")}
            onClick={submitProofs}
          >
            {formState.working ? (
             <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> {t("working")}</>
            ) : (
             <><span className="glyphicon glyphicon-send" aria-hidden="true">&nbsp;</span>{t("step1ESButton")}</>
            )}
          </button>
          <div className={fieldClasses.button.buttonValGrpCls} style={{ display: validationState.button.message ? 'block' : 'none' }}>
            {validationState.button.message}
          </div>
          </div>
        </div>
        </div>
      </div>
      </form>
    </div>
    </div>
  );
};

export default Step1ES;