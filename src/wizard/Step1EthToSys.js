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
const TARGET_NEVM_CHAIN_ID_NUM = CONFIGURATION.ChainId ? parseInt(CONFIGURATION.ChainId, 16) : null;
const TARGET_UTXO_CHAIN_ID_NUM = CONFIGURATION.ChainId ? parseInt(CONFIGURATION.ChainId, 16) : null;

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
        const amountBN = toBaseUnit(amount.toString(), 18, web3.utils.BN); 
        return amountBN && amountBN.gt(new web3.utils.BN(0));
      } else {
        // Fallback for when web3 or BN isn't available
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

// --- Helper function to generate validation classes ---
const getValidationClasses = (isValid, hasMessage = false, isWorking = false, isButton = false) => {
  const mainClass = !isValid ? "has-error" : "has-success";

  if (isButton) {
    const tooltipClass = !isValid || (hasMessage && !isWorking) // && !receiptTxHash ?
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
  const { ethToSysDisplay, paliDetected } = useContext(AppContext);
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
    }, [store]);

  // --- Wallets addresses store ---
  const [walletStatus, setWalletStatus] = useState({
    nevm: {
      detected: false,
      account: null,
      chainId: null,
      networkOk: false, // Is it on the correct network?
    },
    utxo: {
      detected: false,
      account: null,
      chainId: null,
      networkOk: false, // Is it on the correct network?
    }
  });

  // --- Consolidated Form Field Handling ---
  const [formState, setFormState] = useState({
    assetType: getStoredValue('assetType', 'SYS'),
    sysxContract: getStoredValue('sysxContract', ""),
    tokenId: getStoredValue('tokenId', ""),
    toSysAmount: getStoredValue('toSysAmount', ""),
    sysxFromAccount: getStoredValue('sysxFromAccount', ""),
    syscoinWitnessAddress: getStoredValue('syscoinWitnessAddress', ""),
    receiptTxHash: getStoredValue('receiptTxHash', ""),
    working: false,
    allowanceTxHash: (storageExists && localStorage.getItem("allowanceTxHash_ethToSys")) || "",
    isPollingAllowance: (storageExists && localStorage.getItem("isPollingAllowance_ethToSys") === "true") || false,
  });

  // --- Validation State ---
  // Start fields as potentially invalid until checked or user interacts
  // Button starts as invalid until environment check passes
  const [validationState, setValidationState] = useState({
    button: { isValid: false, message: t("step1ESButton") }, // Initial state reflects pending environment check
    sysxFromAccount: { isValid: false, message: '' },
    sysxContract: { isValid: formState.assetType === 'SYS', message: '' }, // Valid if SYS
    tokenId: { isValid: formState.assetType !== 'ERC721' && formState.assetType !== 'ERC1155', message: '' }, // Valid if not NFT
    toSysAmount: { isValid: formState.assetType === 'ERC721', message: '' }, // Valid if ERC721 (fixed amount)
    syscoinWitnessAddress: { isValid: false, message: '' }
  });

  // Refs & Web3 State
  const web3InstanceRef = useRef(null);
  const nevmProviderRef = useRef(null);
  const utxoProviderRef = useRef(null);
  const allowancePollIntervalIdRef = useRef(null);

  // --- Persistence and Form Update ---
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
  }, [updateStore]);

  // Unified form update function
  const updateFormField = useCallback((name, value) => {
    setFormState(prev => ({ ...prev, [name]: value }));
    persistState(name, value);
  }, [persistState]);

  // --- Dedicated Validation Functions ---
  const validateSysxFromAccount = useCallback((value) => {
    if (!value) return { isValid: false, message: t("step1ESEnterFromAccount") };
    if (!validators.isValidEthereumAddress(value)) return { isValid: false, message: t("step2EthAddress") };
    return { isValid: true, message: "" };
  }, [t]);

  const validateSyscoinWitnessAddress = useCallback((value) => {
    if (!value) return { isValid: false, message: t("step1ESEnterWitnessAddress") };
    if (!validators.isValidSyscoinAddress(value)) return { isValid: false, message: t("step2FundingAddress") };
    return { isValid: true, message: "" };
  }, [t]);

  const validateSysxContract = useCallback((value, currentAssetType) => {
    if (currentAssetType === 'SYS') return { isValid: true, message: "" }; // Not needed for SYS
    if (!value) return { isValid: false, message: t("step1ESEnterSYSXContract") };
    if (!validators.isValidEthereumAddress(value)) return { isValid: false, message: t("step2SYSXContract") };
    return { isValid: true, message: "" };
  }, [t]);

  const validateTokenId = useCallback((value, currentAssetType) => {
    if (currentAssetType !== 'ERC721' && currentAssetType !== 'ERC1155') return { isValid: true, message: "" }; // Not needed for others
    if (!validators.isValidTokenId(value)) return { isValid: false, message: t("step2TokenId") };
    return { isValid: true, message: "" };
  }, [t]);

  const validateToSysAmount = useCallback((value, currentAssetType) => {
    if (currentAssetType === 'ERC721') return { isValid: true, message: "" }; // Fixed to 1, always valid conceptually
    const web3 = web3InstanceRef.current; // Access ref directly
    if (!validators.isValidAmount(value, web3)) return { isValid: false, message: t("step2Amount") };
    return { isValid: true, message: "" };
  }, [t, web3InstanceRef]);

  // --- Field-Specific Validation Runner ---
  // Helper to run validation based on field name
  const runFieldValidation = useCallback((name, value) => {
    let result;
    switch (name) {
      case 'sysxFromAccount':
        result = validateSysxFromAccount(value);
        break;
      case 'syscoinWitnessAddress':
        result = validateSyscoinWitnessAddress(value);
        break;
      case 'sysxContract':
        result = validateSysxContract(value, formState.assetType);
        break;
      case 'tokenId':
        result = validateTokenId(value, formState.assetType);
        break;
      case 'toSysAmount':
        result = validateToSysAmount(value, formState.assetType);
        break;
      default:
        result = { isValid: true, message: "" }; // Default for non-validated fields
    }
    setValidationState(prev => ({ ...prev, [name]: result }));
    return result.isValid; // Return validity for potential chaining
  }, [
    formState.assetType, // Needed for context in some validators
    validateSysxFromAccount,
    validateSyscoinWitnessAddress,
    validateSysxContract,
    validateTokenId,
    validateToSysAmount
  ]);

  // --- Unified Input Handler (Triggers Field Validation) ---
  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    updateFormField(name, value); // Update state and persist
    runFieldValidation(name, value); // Run validation for THIS field
  }, [updateFormField, runFieldValidation]);

  // --- Asset Type Change Handler ---
  const handleAssetTypeChange = useCallback((event) => {
    const newAssetType = event.target.value;
    const previousAssetType = formState.assetType;
    const updates = { assetType: newAssetType }; // Collect updates

    // Adjust related fields - Prepare updates, apply them together
    if (newAssetType === 'SYS' && formState.sysxContract) {
      updates.sysxContract = '';
    }
    if (newAssetType !== 'ERC721' && newAssetType !== 'ERC1155' && formState.tokenId) {
      updates.tokenId = '';
    }
    if (newAssetType === 'ERC721' && formState.toSysAmount !== '1') {
      updates.toSysAmount = '1';
    } else if (previousAssetType === 'ERC721' && newAssetType !== 'ERC721') {
      // Clear amount only if switching *away* from ERC721 where it was likely '1'
      // Keep user input otherwise
      if (formState.toSysAmount === '1') updates.toSysAmount = '';
    }

    // Apply all updates to formState at once
    setFormState(prev => ({ ...prev, ...updates }));
    Object.entries(updates).forEach(([name, value]) => persistState(name, value));

    // Re-validate affected fields AFTER state update completes using useEffect or directly.
    // Using a timeout allows state to settle before validation runs on potentially derived values.
    setTimeout(() => {
      if ('sysxContract' in updates || newAssetType === 'SYS' || previousAssetType === 'SYS') {
        runFieldValidation('sysxContract', updates.sysxContract ?? formState.sysxContract);
      }
      if ('tokenId' in updates || newAssetType.includes('ERC') || previousAssetType.includes('ERC')) {
        runFieldValidation('tokenId', updates.tokenId ?? formState.tokenId);
      }
      if ('toSysAmount' in updates || newAssetType === 'ERC721' || previousAssetType === 'ERC721') {
        runFieldValidation('toSysAmount', updates.toSysAmount ?? formState.toSysAmount);
      }
      // Also re-validate fields that *depend* on assetType if they weren't directly updated
      if (!('sysxContract' in updates) && newAssetType !== 'SYS' && previousAssetType === 'SYS') {
        runFieldValidation('sysxContract', formState.sysxContract);
      }
      // ... potentially others if complex dependencies exist
    }, 0);
  }, [formState, persistState, runFieldValidation]);

  const getPaliStateSnapshot = useCallback(async (paliProvider) => {
    if (!paliProvider) return { account: null, chainId: null, networkOk: false, isBitcoinBased: false };

    const isBitcoinBased = paliProvider?._sysState?.isBitcoinBased === true;
    if (!isBitcoinBased) {
      return { account: null, chainId: null, networkOk: false, isBitcoinBased: false };
    }

    try {
      const activeAccount = await paliProvider.request({ method: 'wallet_getAccount' });
      const account = activeAccount?.address || null;
      let chainId = null;
      let networkOk = false;

      if (account) {
        if (account.startsWith("tsys")) chainId = "0x1644"; // 5700
        else if (account.startsWith("sys")) chainId = "0x39"; // 57
      }

      if (chainId && TARGET_UTXO_CHAIN_ID_NUM) {
        networkOk = parseInt(chainId, 16) === TARGET_UTXO_CHAIN_ID_NUM;
      } else if (chainId) { // If chainId is known but no target, consider it ok.
        networkOk = true;
      }
      // If no account, chainId remains null, networkOk false.

      return { account, chainId, networkOk, isBitcoinBased: true };
    } catch (err) {
      console.warn("Error in getPaliStateSnapshot:", err);
      return { account: null, chainId: null, networkOk: false, isBitcoinBased: isBitcoinBased };
    }
  }, []);

  // --- Wallet Connection Logic ---
  const connectPaliWallet = useCallback(async () => {
    const pali = utxoProviderRef.current; // Get from ref
    if (!pali) {
      // This message might appear on the button if checkEnvironmentReadiness shows "Install Pali"
      // and the button is somehow still clicked.
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2InstallPali") } }));
      return;
    }

    // Existing checks from your code:
    if (pali._sysState && pali._sysState.isBitcoinBased !== true) {
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2SwitchUTXONetwork") } }));
      return;
    }

    setFormState(prev => ({ ...prev, working: true })); // Indicate an action is in progress
    setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2UnlockPali") + "..." } }));

    try {
      await pali.request({ method: 'sys_requestAccounts' });
      // Listeners will update walletStatus. The useEffect listening to walletStatus
      // will then call checkEnvironmentReadiness to update the button.
    } catch (err) {
      console.error("Failed to connect Pali wallet:", err);
      const message = (err.code === 4001) ? t("step2UserRejectedPali") : (t("genericError") + " (Pali Connect)");
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: message } }));
      // Ensure account state is nullified on failure
      setWalletStatus(prev => ({ ...prev, utxo: { ...prev.utxo, account: null } }));
    } finally {
      setFormState(prev => ({ ...prev, working: false }));
    }
  }, [t, setWalletStatus, setValidationState, setFormState]);

  const connectNEVMWallet = useCallback(async (provider) => {
    if (!provider) {
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3InstallMetamask") } }));
      return;
    }
    try {
      // Trigger connection prompt
      await provider.request({ method: 'eth_requestAccounts' });
      // No need to update state here, the 'accountsChanged' listener will do it.
    } catch (error) {
      console.error('Failed to connect NEVM wallet:', error);
      // Set button state on connection error/rejection
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3LoginMetamask") } }));
    }
  }, [t, setValidationState]);

  // --- Environment Readiness Check ---
  const initiateAllowanceTransaction = useCallback(async (contractBase, methodName, methodArgs) => {
    if (!nevmProviderRef.current || !web3InstanceRef.current) {
        console.error("initiateAllowanceTransaction: Pre-conditions not met.");
        setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3InstallMetamask") }}));
        setFormState(prev => ({ ...prev, working: false }));
        return;
    }

    setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2PleaseSign") } }));
    setFormState(prev => ({ ...prev, working: true }));

    try {
      const approvalData = contractBase.methods[methodName](...methodArgs).encodeABI();
      const gasEstimate = await contractBase.methods[methodName](...methodArgs).estimateGas({ from: formState.sysxFromAccount });
      const gasLimit = Math.ceil(gasEstimate * 1.2);

      const approvalTxParams = {
        from: formState.sysxFromAccount,
        to: contractBase.options.address,
        data: approvalData,
        gas: web3InstanceRef.current.utils.toHex(gasLimit),
      };

      const txHash = await nevmProviderRef.current.request({
        method: 'eth_sendTransaction',
        params: [approvalTxParams],
      });
      console.log(`${methodName} allowance transaction submitted, hash: ${txHash}`);

      if (storageExists) {
        localStorage.setItem("allowanceTxHash_ethToSys", txHash);
        localStorage.setItem("isPollingAllowance_ethToSys", "true");
      }

      // Update formState to set the new hash and signal that polling should start.
      // The useEffect hook watching formState.isPollingAllowance will actually start the interval.
      setFormState(prev => ({
        ...prev,
        allowanceTxHash: txHash,
        isPollingAllowance: true,
        // working: true is already set
      }));
      // An immediate message after successful submission before polling kicks in:
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3PleaseWait") } }));


    } catch (error) {
      console.error(`Error initiating ${methodName} allowance transaction:`, error);
      let message = error.message || t("genericError");
      setValidationState(prev => ({ ...prev, button: { isValid: false, message }}));
      // Ensure polling is marked false and working is false if TX submission fails
      setFormState(prev => ({
        ...prev,
        working: false,
        isPollingAllowance: false,
        // Keep previous allowanceTxHash if this new submission failed, or clear it
        // allowanceTxHash: "" // Optional: clear hash on submission failure
      }));
      if(storageExists) {
        localStorage.setItem("isPollingAllowance_ethToSys", "false");
        // localStorage.removeItem("allowanceTxHash_ethToSys"); // Optional
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.sysxFromAccount, t, web3InstanceRef, nevmProviderRef]);

  const checkEnvironmentReadiness = useCallback(() => {
    const { nevm, utxo } = walletStatus;

    // Wallet Detection
    if (!paliDetected) { // Global detection from context
      return { isOverallReady: false, message: t("step2InstallPali") };
    }
    if (!utxo.detected) {
      return { isOverallReady: false, message: t("step2SwitchUTXONetwork") };
    }
    if (!nevm.detected) {
      return { isOverallReady: false, message: t("step3InstallMetamask") };
    }

    // Pali Specific Checks (if UTXO wallet is detected by component)
    const paliProvider = utxoProviderRef.current;
    if (paliProvider && paliProvider._sysState && paliProvider._sysState.isBitcoinBased !== true) {
      return { isOverallReady: false, message: t("step2SwitchPaliToUTXO") };
    }
    // These messages are for when Pali IS detected and IS on UTXO mode, but account/network is the issue
    if (!utxo.account) {
      return { isOverallReady: false, message: t("step2UnlockPali") }; // "Connect or Unlock Pali"
    }
    if (!utxo.networkOk) {
      return { isOverallReady: false, message: t("step2SwitchUTXONetwork") };
    }

    // NEVM Specific Checks
    if (!nevm.account) {
      if (nevm.detected && !nevm.networkOk && nevm.chainId) {
        return { isOverallReady: false, message: t("stepUseMainnet") };
      }
      return { isOverallReady: false, message: t("step3LoginMetamask") };
    }
    if (!nevm.networkOk) {
      return { isOverallReady: false, message: t("stepUseMainnet") };
    }

    // All environment checks passed
    return { isOverallReady: true, message: "" };

  }, [walletStatus, t, paliDetected]);

  // --- Comprehensive Pre-Submission Check ---
  const validateForSubmission = useCallback(() => {
    const envCheck = checkEnvironmentReadiness(); // paliDetected is used inside checkEnvironmentReadiness

    // A. If Pali is not globally detected (from context via checkEnvironmentReadiness),
    //  or if our component state says utxo is not detected, button is invalid.
    if (!paliDetected || !walletStatus.utxo.detected) {
      return { isReady: false, message: envCheck.message || t("step2InstallPali") };
    }

    // B. If the environment itself is NOT ready (e.g., wrong network, account not connected),
    //  the button is invalid and shows the specific environment message.
    //  This takes PRECEDENCE over field validation messages for the MAIN BUTTON.
    if (!envCheck.isOverallReady) {
      return { isReady: false, message: envCheck.message };
    }

    // C. Environment IS ready. Now, validate ACTIVE FORM FIELDS.
    let firstFieldErrorMessage = "";
    let allFieldsValid = true;
    const newFieldValidations = {}; // To update individual field validation states

    const fieldsToValidate = ['sysxFromAccount', 'syscoinWitnessAddress'];
    if (formState.assetType !== 'SYS') fieldsToValidate.push('sysxContract');
    if (formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') fieldsToValidate.push('tokenId');
    if (formState.assetType !== 'ERC721') fieldsToValidate.push('toSysAmount');

    for (const name of fieldsToValidate) {
      const value = formState[name];
      let result;
      // Field-specific validation calls (no change here)
      switch (name) {
        case 'sysxFromAccount': result = validateSysxFromAccount(value); break;
        case 'syscoinWitnessAddress': result = validateSyscoinWitnessAddress(value); break;
        case 'sysxContract': result = validateSysxContract(value, formState.assetType); break;
        case 'tokenId': result = validateTokenId(value, formState.assetType); break;
        case 'toSysAmount': result = validateToSysAmount(value, formState.assetType); break;
        default: result = { isValid: true, message: "" };
      }
      newFieldValidations[name] = result; // Store for individual field feedback
      if (!result.isValid) {
        allFieldsValid = false;
        if (!firstFieldErrorMessage) firstFieldErrorMessage = result.message;
      }
    }

    // Update the validation state for all individual fields
    setValidationState(prev => ({ ...prev, ...newFieldValidations }));

    if (!allFieldsValid) {
      // Fields are invalid. Main button shows the first field error.
      return { isReady: false, message: firstFieldErrorMessage || t("genericFormError") };
    }

    // All checks passed: Pali detected, environment good, fields valid.
    return { isReady: true, message: "" }; // Ready for submission

  }, [
    checkEnvironmentReadiness,
    paliDetected, // from top-level context
    walletStatus,
    formState,
    t,
    validateSysxFromAccount,
    validateSyscoinWitnessAddress,
    validateSysxContract,
    validateTokenId,
    validateToSysAmount,
    setValidationState
  ]);

  // --- Effects ---
  // Effect for Environment Readiness Check (and initial field validation)
  useEffect(() => {
    if (ethToSysDisplay) {
      const submissionReadiness = validateForSubmission();
      setValidationState(prev => ({
        ...prev,
        button: {
          isValid: submissionReadiness.isReady,
          // Use the message from submissionReadiness
          message: submissionReadiness.message
        }
      }));

      // Initial validation of active fields
      const fieldsToValidate = ['sysxFromAccount', 'syscoinWitnessAddress'];
      if (formState.assetType !== 'SYS') fieldsToValidate.push('sysxContract');
      fieldsToValidate.forEach(name => {
        runFieldValidation(name, formState[name]);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethToSysDisplay, walletStatus, formState.assetType, validateForSubmission, runFieldValidation, t]);


  // Effect for NEVM Wallet Initialization and Listener Registration
  useEffect(() => {
    let isMounted = true;

    const handleNEVMAccountsChanged = (accounts) => {
      if (!isMounted) return;
      const account = accounts?.[0] || null;
      console.log("NEVM accounts changed:", account);
      setWalletStatus(prev => ({
        ...prev,
        nevm: { ...prev.nevm, account: account }
      }));
      // Form field update suggestion handled in render logic based on walletStatus.account vs formState.sysxFromAccount
    };

    const handleNEVMChainChanged = (chainIdHex) => {
      if (!isMounted) return;
      const currentChainIdNum = chainIdHex ? parseInt(chainIdHex, 16) : null;
      const networkOk = TARGET_NEVM_CHAIN_ID_NUM ? currentChainIdNum === TARGET_NEVM_CHAIN_ID_NUM : true; // Assume ok if no target
      setWalletStatus(prev => ({
        ...prev,
        nevm: { ...prev.nevm, chainId: chainIdHex, networkOk: networkOk }
      }));
      if (nevmProviderRef.current) {
        web3InstanceRef.current = new Web3(nevmProviderRef.current); // Update web3 instance
      }
    };

    const initNEVM = async () => {
      try {
        const provider = await detectEthereumProvider({ mustBeMetaMask: false, silent: true });
        if (provider && isMounted) {
          nevmProviderRef.current = provider;
          web3InstanceRef.current = new Web3(provider); // Initialize web3 instance

          let chainIdHex = null;
          let accounts = [];
          let networkOk = false;

          try {
            chainIdHex = await provider.request({ method: 'eth_chainId' });
            const currentChainIdNum = chainIdHex ? parseInt(chainIdHex, 16) : null;
            networkOk = TARGET_NEVM_CHAIN_ID_NUM ? currentChainIdNum === TARGET_NEVM_CHAIN_ID_NUM : true;
          } catch (err) { console.warn("Could not get chain ID on init:", err); }

          try {
            // Use eth_accounts which returns array or empty array, doesn't prompt
            accounts = await provider.request({ method: 'eth_accounts' });
          } catch (err) { console.warn("Could not get accounts on init:", err); }

          if (isMounted) {
            setWalletStatus(prev => ({
              ...prev,
              nevm: {
                detected: true,
                account: accounts?.[0] || null,
                chainId: chainIdHex,
                networkOk: networkOk
              }
            }));

            // Setup listeners
            provider.on('accountsChanged', handleNEVMAccountsChanged);
            provider.on('chainChanged', handleNEVMChainChanged);
          }
        } else if (isMounted) {
          console.log('NEVM provider not detected.');
          setWalletStatus(prev => ({ ...prev, nevm: { ...prev.nevm, detected: false } }));
        }
      } catch (error) {
        console.error("Error initializing NEVM Wallet:", error);
        if (isMounted) setWalletStatus(prev => ({ ...prev, nevm: { ...prev.nevm, detected: false } }));
      }
    };

    initNEVM();

    return () => {
      isMounted = false;
      if (nevmProviderRef.current?.removeListener) {
        nevmProviderRef.current.removeListener('accountsChanged', handleNEVMAccountsChanged);
        nevmProviderRef.current.removeListener('chainChanged', handleNEVMChainChanged);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethToSysDisplay]);


  // Effect for Pali Wallet Initialization and Listener Registration
  useEffect(() => {
    if (!ethToSysDisplay) {
      // When hidden, reset our component's utxo state
      setWalletStatus(prev => ({...prev, utxo: { detected: false, account: null, chainId: null, networkOk: false }}));
      utxoProviderRef.current = null;
      return;
    }

    if (!paliDetected) { // USE the paliDetected from component scope
      setWalletStatus(prev => ({...prev, utxo: { detected: false, account: null, chainId: null, networkOk: false }}));
      utxoProviderRef.current = null;
      return;
    }

    const pali = window.pali;

    if (!pali) {
      console.error("AppContext reported Pali detected, but window.pali is not found.");
      setWalletStatus(prev => ({...prev, utxo: {...prev.utxo, detected: false}}));
      utxoProviderRef.current = null;
      return;
    }

    let isMounted = true;
    utxoProviderRef.current = pali;

    // Set detected TRUE in our local state immediately if pali object exists
    setWalletStatus(prev => ({...prev, utxo: {...prev.utxo, detected: true }}));

    const handleUTXOAccountsChanged = (accounts) => {
      if (!isMounted) return;
      // Re-check entire Pali state on account change using the snapshot utility
      getPaliStateSnapshot(utxoProviderRef.current).then(snapshot => {
        if (isMounted) {
          console.log("Pali 'accountsChanged' processed, new snapshot:", snapshot);
          setWalletStatus(prev => ({
            ...prev,
            utxo: {
              detected: snapshot.isBitcoinBased,
              account: snapshot.account,
              chainId: snapshot.chainId,
              networkOk: snapshot.networkOk
            }
          }));
        }
      });
    };

    const handleUTXOChainChanged = (chainIdHex) => { // Pali might not always send chainIdHex here for UTXO.
      if (!isMounted) return;
      // Re-check entire Pali state on chain change
      getPaliStateSnapshot(utxoProviderRef.current).then(snapshot => {
        if (isMounted) {
          // The snapshot contains the most up-to-date info after a chain change.
          setWalletStatus(prev => ({
            ...prev,
            utxo: {
              detected: snapshot.isBitcoinBased,
              account: snapshot.account,
              chainId: snapshot.chainId,
              networkOk: snapshot.networkOk
            }
          }));
        }
      });
    };

    // Potentially other Pali specific events like '_unlockStateChanged'
    // const handleUnlockStateChanged = ({ isUnlocked }) => { ... if (isMounted) ... getPaliStateSnapshot ... }

    // Initial state fetch
    getPaliStateSnapshot(pali).then(initialSnapshot => {
      if (isMounted) {
        setWalletStatus(prev => ({
          ...prev,
          utxo: {
            detected: initialSnapshot.isBitcoinBased, // Crucial: only "detected" for UTXO purposes if Bitcoin-based
            account: initialSnapshot.account,
            chainId: initialSnapshot.chainId,
            networkOk: initialSnapshot.networkOk
          }
        }));
      }
    });

    pali.on('accountsChanged', handleUTXOAccountsChanged);
    pali.on('chainChanged', handleUTXOChainChanged); // Verify if Pali reliably emits this for UTXO mode with a payload.
    // pali.on('_unlockStateChanged', handleUnlockStateChanged); // If this event is useful

    return () => {
      isMounted = false;
      if (pali?.removeListener) {
        pali.removeListener('accountsChanged', handleUTXOAccountsChanged);
        pali.removeListener('chainChanged', handleUTXOChainChanged);
        // pali.removeListener('_unlockStateChanged', handleUnlockStateChanged);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethToSysDisplay, getPaliStateSnapshot, paliDetected]);

  // --- Transaction Submission ---
  const freezeBurn = useCallback(async (
    syscoinERC20Manager,
    amountBN,
    contractAddress,
    nftId,
    witnessAddress,
    nevFromAccount
  ) => {
    // Caller (checkAllowanceTxStatus or submitProofs) should have set working: true
    // and an appropriate "Please sign..." message for freezeBurn.
    setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3AuthAllowanceMetamask") } }));
    setFormState(prev => ({ ...prev, working: true })); // Ensure working is true

    const web3 = web3InstanceRef.current;
    if (!web3) {
      setFormState(prev => ({ ...prev, working: false }));
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3InstallMetamask") } }));
      return;
    }
    if (!nevmProviderRef.current || typeof nevmProviderRef.current.request !== 'function') {
      setFormState(prev => ({ ...prev, working: false }));
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("genericError") } }));
      return;
    }

    const amountString = amountBN.toString();
    const contractAddrToSend = contractAddress || ZERO_ADDRESS;
    const tokenIdToSend = nftId || "0";

    let valueForEstimateGas;
    let valueForSendTx;

    if (formState.assetType === 'SYS' && amountBN) {
      valueForEstimateGas = amountBN.toString();
      valueForSendTx = web3.utils.toHex(amountBN);
    } else {
      valueForEstimateGas = "0";
      valueForSendTx = "0x0";
    }

    try {
      const encodedData = syscoinERC20Manager.methods
        .freezeBurn(amountString, contractAddrToSend, tokenIdToSend, witnessAddress)
        .encodeABI();

      const gasEstimate = await syscoinERC20Manager.methods
        .freezeBurn(amountString, contractAddrToSend, tokenIdToSend, witnessAddress)
        .estimateGas({ from: nevFromAccount, value: valueForEstimateGas });
      const gasLimit = Math.ceil(gasEstimate * 1.2);

      const txParams = {
        from: nevFromAccount,
        to: CONFIGURATION.ERC20Manager,
        data: encodedData,
        gas: web3.utils.toHex(gasLimit),
        value: valueForSendTx,
      };

      const txHash = await nevmProviderRef.current.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      updateFormField('receiptTxHash', txHash); // Main receipt hash for Step 2
      setValidationState(prev => ({...prev, button: { isValid: false, message: t("step3ReceiptTxHash") + ": " + txHash.substring(0,10) + "..." }}));

      // Clear allowance-specific items from localStorage as we are moving on
      if(storageExists) {
        localStorage.removeItem("allowanceTxHash_ethToSys");
        localStorage.removeItem("isPollingAllowance_ethToSys");
      }
      // Also clear from component state if needed, though navigation will reset
      setFormState(prev => ({...prev, allowanceTxHash: "", isPollingAllowance: false}));

      if (jumpToStep) {
        jumpToStep(1);
      } else {
        console.warn("jumpToStep function not provided, tx submitted.");
        setFormState(prev => ({ ...prev, working: false }));
      }
    } catch (err) {
      console.error("Error in freezeBurn process:", err);
      setFormState(prev => ({ ...prev, working: false }));
      let message = err.message || t("genericError");
      if (err.code === 4001) { message = t("userRejectedTransaction") || "User rejected transaction.";  }

      updateFormField('receiptTxHash', '');
      setValidationState(prev => ({...prev, button: { isValid: false, message: (t("genericError") + ": " + message).substring(0,100) }}));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.assetType, t, updateFormField, jumpToStep]);

  const checkAllowanceTxStatus = useCallback(async () => {
    if (!formState.allowanceTxHash || !web3InstanceRef.current) {
      console.warn("checkAllowanceTxStatus: Pre-conditions not met (no allowanceTxHash or web3 instance). Stopping poll.");
      if (allowancePollIntervalIdRef.current) clearInterval(allowancePollIntervalIdRef.current);
      allowancePollIntervalIdRef.current = null;
      setFormState(prev => ({ ...prev, isPollingAllowance: false, working: false }));
      if(storageExists) localStorage.setItem("isPollingAllowance_ethToSys", "false");
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("genericError") } }));
      return;
    }

    // The button message should already reflect polling from initiateAllowanceTransaction or useEffect
    // Ensure 'working' is true to keep button visually active/disabled
    setFormState(prev => ({ ...prev, working: true }));

    try {
      const receipt = await web3InstanceRef.current.eth.getTransactionReceipt(formState.allowanceTxHash);

      if (receipt) { // Receipt found
        if (allowancePollIntervalIdRef.current) {
          clearInterval(allowancePollIntervalIdRef.current);
          allowancePollIntervalIdRef.current = null;
        }
        // Persist that polling is no longer active for this hash
        if (storageExists) {
          localStorage.setItem("isPollingAllowance_ethToSys", "false");
          // We can keep allowanceTxHash in localStorage for informational purposes or clear it.
          // Clearing it means if freezeBurn fails later, a new allowance might be requested unnecessarily.
          // Let's keep it for now, it will be overwritten by a new attempt.
        }

        setFormState(prev => ({ ...prev, isPollingAllowance: false })); // Update state: polling stopped

        if (receipt.status === true || receipt.status === 1 || receipt.status === '0x1') {
          console.log("Allowance transaction successful:", receipt);
          setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step1AllowanceSuccess") } }));

          const web3 = web3InstanceRef.current;
          const BN = web3.utils.BN;
          let decimals; // Declare decimals

          // Correctly determine decimals based on assetType
          if (formState.assetType === 'ERC20' && formState.sysxContract) {
            // We need a contract instance to call decimals()
            // The ABI for SyscoinERC20I should be suitable for a standard decimals() call.
            const tokenContractForDecimals = new web3.eth.Contract(assetabierc20, formState.sysxContract);
            try {
              decimals = await tokenContractForDecimals.methods.decimals().call();
              decimals = parseInt(decimals.toString(), 10); // Ensure it's a number
            } catch (e) {
              console.warn("checkAllowanceTxStatus: Could not fetch decimals for ERC20, assuming 18.", e);
              decimals = 18; // Fallback if decimals() call fails
            }
          } else if (formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') {
            decimals = 0; // NFTs: amount is typically 1, so 0 decimals for toBaseUnit
          } else { // For 'SYS' or other types if any (though SYS won't use contractBase here)
            decimals = 18; // Default for SYS
          }

          const syscoinERC20Manager = new web3.eth.Contract(erc20Managerabi, CONFIGURATION.ERC20Manager);
          const amountBNValue = (formState.assetType === 'ERC721') // For ERC721, amount is always 1
            ? new BN(1)
            : toBaseUnit(formState.toSysAmount, decimals, BN); // Use the determined decimals

          const nftIdValue = (formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') ? formState.tokenId : '0';

          if (amountBNValue === undefined || amountBNValue.lt(new BN(0))) {
            setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step2Amount") }}));
            setFormState(prev => ({ ...prev, working: false })); // Allow retry
            return;
          }
          await freezeBurn(syscoinERC20Manager, amountBNValue, formState.sysxContract, nftIdValue, formState.syscoinWitnessAddress, formState.sysxFromAccount);

        } else { // Allowance TX FAILED on-chain
          console.error("Allowance transaction failed on-chain:", receipt);
          setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("genericError") } }));
          setFormState(prev => ({ ...prev, working: false })); // Re-enable main button for retry
        }
      } else {
        // Receipt not yet available, still pending. Polling continues.
        // Message should reflect ongoing polling, set by initiateAllowance or useEffect.
        setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3PleaseWait") } }));
      }
    } catch (error) {
      console.error("Error in checkAllowanceTxStatus fetching receipt:", error);
      // Potentially an RPC error. Keep polling for a while.
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3PleaseWait") } }));
      // formState.working remains true, interval continues.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.allowanceTxHash, formState.assetType, formState.sysxContract, formState.sysxFromAccount, formState.toSysAmount, formState.tokenId, freezeBurn, t]);

  // Effect for Managing Allowance Polling Interval
  useEffect(() => {
    // Only run if the component is displayed and we are supposed to be polling
    if (ethToSysDisplay && formState.isPollingAllowance && formState.allowanceTxHash) {
      // If an interval isn't already running for this polling session, start it.
      if (!allowancePollIntervalIdRef.current) {
        // Call once immediately to check status without waiting for the first interval
        checkAllowanceTxStatus();

        // Then set up the interval for subsequent checks
        allowancePollIntervalIdRef.current = setInterval(checkAllowanceTxStatus, 15000);

        // Update UI to reflect polling status if not already optimally set
        setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3PleaseWait") } }));
        setFormState(prev => ({ ...prev, working: true })); // Ensure button is disabled
      }
    } else if ((!formState.isPollingAllowance || !ethToSysDisplay) && allowancePollIntervalIdRef.current) {
      // If we are no longer supposed to be polling OR component is not displayed,
      // and an interval is running, clear it.
      console.log("useEffect: Stopping polling interval. isPolling:", formState.isPollingAllowance, "display:", ethToSysDisplay);
      clearInterval(allowancePollIntervalIdRef.current);
      allowancePollIntervalIdRef.current = null;
      // If polling was stopped because it's done (not just navigating away), ensure 'working' is false
      if (!formState.isPollingAllowance && formState.working) {
        // Check if message indicates success/failure already, otherwise set a general one or leave as is
        // This might already be handled by checkAllowanceTxStatus, this is a fallback.
        // if (!validationState.button.message.includes("granted") && !validationState.button.message.includes("failed")) {
        //   setValidationState(prev => ({ ...prev, button: { isValid: true, message: t("step1ESButton") }})); // Or an appropriate "ready" message
        // }
        // setFormState(prev => ({...prev, working: false})); // This should be handled by the functions that stop polling
      }
    }

    // Cleanup function for when the component unmounts
    return () => {
      if (allowancePollIntervalIdRef.current) {
        console.log("useEffect cleanup (unmount): Clearing allowance poll interval ID:", allowancePollIntervalIdRef.current);
        clearInterval(allowancePollIntervalIdRef.current);
        allowancePollIntervalIdRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethToSysDisplay, formState.isPollingAllowance, formState.allowanceTxHash, checkAllowanceTxStatus]);

  const submitProofs = useCallback(async () => {
    const submissionReadiness = validateForSubmission();
    if (!submissionReadiness.isReady) {
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: submissionReadiness.message } }));
      if (paliDetected && walletStatus.utxo.detected && !walletStatus.utxo.account && submissionReadiness.message === t("step2UnlockPali")) {
        await connectPaliWallet();
      }
      return;
    }

    setFormState(prev => ({ ...prev, working: true }));
    setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step1CheckingAllowance") } }));

    const web3 = web3InstanceRef.current;
    if (!web3 || !nevmProviderRef.current) {
      setFormState(prev => ({...prev, working: false }));
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step3InstallMetamask") }}));
      return;
    }
    const BN = web3.utils.BN;

    let assetABI;
    let decimals = 18;
    switch (formState.assetType) {
      case 'ERC721': assetABI = assetabierc721; decimals = 0; break;
      case 'ERC1155': assetABI = assetabierc1155; decimals = 0; break;
      case 'ERC20': assetABI = assetabierc20; break;
      default: assetABI = assetabierc20;
    }
    const syscoinERC20Manager = new web3.eth.Contract(erc20Managerabi, CONFIGURATION.ERC20Manager);
    let contractBase = null;
    const nftIdValue = (formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') ? formState.tokenId : '0';

    try {
      if (formState.assetType !== 'SYS' && formState.sysxContract) {
        contractBase = new web3.eth.Contract(assetABI, formState.sysxContract);
        if (formState.assetType === 'ERC20') {
          try { decimals = await contractBase.methods.decimals().call(); }
          catch (e) { console.warn("Could not fetch decimals for ERC20, assuming 18.", e); decimals = 18; }
        }
      }
      const amountBNValue = (formState.assetType === 'ERC721')
        ? new BN(1)
        : toBaseUnit(formState.toSysAmount, decimals, BN);

      if (amountBNValue === undefined || amountBNValue.lt(new BN(0))) {
        setValidationState(prev => ({ ...prev, toSysAmount: { isValid: false, message: t("step2Amount")}, button: { isValid: false, message: t("step2Amount")}}));
        setFormState(prev => ({ ...prev, working: false }));
        return;
      }

      let needsAllowanceTx = false;
      if (formState.assetType === 'ERC20' && contractBase) {
        const currentAllowance = await contractBase.methods.allowance(formState.sysxFromAccount, CONFIGURATION.ERC20Manager).call();
        if (new BN(currentAllowance.toString()).lt(amountBNValue)) { needsAllowanceTx = true; }
      } else if ((formState.assetType === 'ERC721' || formState.assetType === 'ERC1155') && contractBase) {
        const isApproved = await contractBase.methods.isApprovedForAll(formState.sysxFromAccount, CONFIGURATION.ERC20Manager).call();
        if (!isApproved) { needsAllowanceTx = true; }
      }

      if (needsAllowanceTx) {
        // If we are already polling a previous allowance attempt, the useEffect will handle it.
        // The button message will reflect this. User just waits.
        if (formState.isPollingAllowance && formState.allowanceTxHash) {
          console.log("submitProofs: Already polling an allowance transaction:", formState.allowanceTxHash);
          setValidationState(prev => ({ ...prev, button: { isValid: false, message: t("step1CheckingAllowance") } }));
          // working: true is already set. The useEffect manages the interval.
        } else {
            // Not polling, or previous poll failed. Initiate a new allowance transaction.
            const methodName = (formState.assetType === 'ERC20') ? "approve" : "setApprovalForAll";
            const methodArgs = (formState.assetType === 'ERC20')
              ? [CONFIGURATION.ERC20Manager, amountBNValue.toString()]
              : [CONFIGURATION.ERC20Manager, true];
            await initiateAllowanceTransaction(contractBase, methodName, methodArgs);
            // initiateAllowanceTransaction sets isPollingAllowance=true, useEffect will start the interval.
        }
      } else { // No allowance transaction needed
        setValidationState(prev => ({ ...prev, button: { isValid: false, message: "" } }));
        await freezeBurn(syscoinERC20Manager, amountBNValue, formState.sysxContract, nftIdValue, formState.syscoinWitnessAddress, formState.sysxFromAccount);
      }

    } catch (error) {
      console.error("Error in submitProofs orchestration:", error);
      setFormState(prev => ({ ...prev, working: false, isPollingAllowance: false }));
      let errorMsg = error.message || t("genericError");
      if (error.code === 4001) { errorMsg = t("step2PleaseSign"); }
      updateFormField('receiptTxHash', '');
      setValidationState(prev => ({ ...prev, button: { isValid: false, message: errorMsg.substring(0,150) } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    validateForSubmission, connectPaliWallet, walletStatus.utxo, t,
    formState, // Includes all sub-fields. Be specific if perf is an issue.
    initiateAllowanceTransaction,
    freezeBurn,
    updateFormField
  ]);

  // --- Render Logic ---
  // getValidationClasses helper remains the same (assuming it produces correct classes)
  // fieldClasses derivation remains the same (deriving from validationState)
  const fieldClasses = {
    button: getValidationClasses(
      validationState.button.isValid,
      !!validationState.button.message,
      formState.working,
      true
    ),
    toSysAmount: getValidationClasses(validationState.toSysAmount.isValid),
    syscoinWitnessAddress: getValidationClasses(validationState.syscoinWitnessAddress.isValid),
    sysxFromAccount: getValidationClasses(validationState.sysxFromAccount.isValid),
    tokenId: getValidationClasses(validationState.tokenId.isValid),
    sysxContract: getValidationClasses(validationState.sysxContract.isValid),
  };

  // Function to handle filling address from wallet
  const fillAddressFromWallet = useCallback((fieldType) => {
    if (fieldType === 'nevm' && walletStatus.nevm.account) {
      updateFormField('sysxFromAccount', walletStatus.nevm.account);
      runFieldValidation('sysxFromAccount', walletStatus.nevm.account); // Validate after fill
    } else if (fieldType === 'utxo' && walletStatus.utxo.account) {
      updateFormField('syscoinWitnessAddress', walletStatus.utxo.account);
      runFieldValidation('syscoinWitnessAddress', walletStatus.utxo.account); // Validate after fill
    }
  }, [walletStatus, updateFormField, runFieldValidation]);


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
          {/* Apply classes to the direct wrapper div */}
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
            {/* Tooltip div */}
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

            {walletStatus.nevm.account && formState.sysxFromAccount.toLowerCase() !== walletStatus.nevm.account.toLowerCase() ? (
              // Wallet connected with account, different from input -> Show suggestion button
              <button
                type="button"
                onClick={() => fillAddressFromWallet('nevm')} // Use NEW handler
                className="btn btn-default wallet-connect-btn"
                disabled={formState.working}
              >
                <span className="wallet-icon"></span>
                {/* Display address from walletStatus */}
                {walletStatus.nevm.account.substring(0, 6)}...{walletStatus.nevm.account.substring(38)}
              </button>
            ) : !walletStatus.nevm.account && walletStatus.nevm.detected ? (
              // Wallet detected, but no account connected -> Show connect button
              <button
                type="button"
                // Call connectNEVMWallet directly, provider ref is available
                onClick={() => connectNEVMWallet(nevmProviderRef.current)}
                className="btn btn-default wallet-connect-btn"
                disabled={formState.working}
              >
                <span className="wallet-icon"></span>
                {t("connectNEVMWallet")}
              </button>
            ) : !walletStatus.nevm.detected ? (
              // No provider detected -> Show install message
              <div className="wallet-notice">{t("step3InstallMetamask")}</div>
            ) : (
              // Account matches input, or wallet not detected and no account -> Render nothing extra
              <span></span>
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
            {/* Tooltip div */}
            {validationState.toSysAmount.message ? (
            <div className={fieldClasses.toSysAmount.valGrpCls}>
              {validationState.toSysAmount.message}
            </div>
            ) : (
              <span></span>
            )}
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

            {walletStatus.utxo.account && formState.syscoinWitnessAddress.toLowerCase() !== walletStatus.utxo.account.toLowerCase() && walletStatus.utxo.networkOk ? (
              // Wallet connected with account, different from input -> Show suggestion button
              <button
                type="button"
                onClick={() => fillAddressFromWallet('utxo')} // Use NEW handler
                className="btn btn-default wallet-connect-btn"
                disabled={formState.working}
              >
                <span className="wallet-icon"></span>
                {/* Display address from walletStatus - adjust substring length */}
                {walletStatus.utxo.account.substring(0, 6)}...{walletStatus.utxo.account.substring(walletStatus.utxo.account.length - 4)}
              </button>
            ) : !walletStatus.utxo.account && walletStatus.utxo.detected ? (
              // Wallet detected, but no account connected -> Show connect button
              <button
                type="button"
                onClick={connectPaliWallet}
                className="btn btn-default wallet-connect-btn"
                disabled={formState.working}
              >
                <span className="wallet-icon"></span>
                {t("step2SwitchUTXONetwork")}
              </button>
            ) : !walletStatus.utxo.detected ? (
              // No provider detected -> Show install message
              <div className="wallet-notice">{t("step2InstallPali")}</div>
            ) : (
              // Account matches input, or wallet not detected and no account -> Render nothing extra
              <span></span>
            )}


            {/* Tooltip div */}
            {validationState.syscoinWitnessAddress.message ? (
            <div className={fieldClasses.syscoinWitnessAddress.valGrpCls}>
              {validationState.syscoinWitnessAddress.message}
            </div>
            ) : (
              <span></span>
            )}
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
                <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> {t("step1ESButton")}</>
              ) : (
                <><span className="glyphicon glyphicon-send" aria-hidden="true"></span> {t("step1ESButton")}</>
              )}
            </button>
            <div
              className={fieldClasses.button.buttonValGrpCls} // Uses derived class
              style={{ display: validationState.button.message ? 'block' : 'none' }}
            >
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